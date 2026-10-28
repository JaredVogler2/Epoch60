// Release check of the built game (run `npm run build` first; then `npm run verify:release`). What Vercel would serve
// must be whole, within its size budget and sent under the production headers; every problem is listed and the exit
// code is 1 if there is any. Plain Node (no imports beyond node:), so CI runs it straight after the build.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

/** The JavaScript and CSS together, gzipped and raw (session 7 measured 433 kB and 1.52 MB). */
export const BUDGET_GZIP = 520_000;
export const BUDGET_RAW = 1_800_000;

export interface ReleaseCheck {
  problems: string[];
  raw: number;
  gzip: number;
}

interface VercelConfig {
  buildCommand?: string;
  outputDirectory?: string;
  headers?: { source: string; headers: { key: string; value: string }[] }[];
}

/** Check a built `dist` folder and the `vercel.json` that serves it. */
export function verifyRelease(dist: string, vercelJson: string): ReleaseCheck {
  const problems: string[] = [];
  const out: ReleaseCheck = { problems, raw: 0, gzip: 0 };
  const index = join(dist, 'index.html');
  if (!existsSync(index)) {
    problems.push('dist/index.html is missing (run npm run build)');
    return out;
  }
  const html = readFileSync(index, 'utf8');
  if (!html.includes('<div id="root"></div>')) problems.push('index.html has no #root element');
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push('index.html has no title');
  // The content security policy refuses inline scripts and styles: every one must be a file.
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!/\bsrc=/.test(m[1]!) || m[2]!.trim()) problems.push('index.html has an inline script');
  }
  if (/<style\b/.test(html) || /\sstyle=/.test(html)) problems.push('index.html has an inline style');
  for (const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    const ref = m[1]!;
    if (/^(?:[a-z]+:)?\/\//i.test(ref)) problems.push(`index.html loads from another origin: ${ref}`);
    else if (!existsSync(join(dist, ref.replace(/^\//, ''))))
      problems.push(`index.html references a missing file: ${ref}`);
  }

  const assets = join(dist, 'assets');
  const files = existsSync(assets) ? readdirSync(assets) : [];
  if (!files.some((f) => f.endsWith('.js'))) problems.push('no JavaScript was built');
  for (const f of files) {
    if (f.endsWith('.map')) problems.push(`a source map is shipped: assets/${f}`);
    if (!/\.(?:js|css)$/.test(f)) continue;
    const buf = readFileSync(join(assets, f));
    out.raw += buf.length;
    out.gzip += gzipSync(buf, { level: 9 }).length;
    if (!f.endsWith('.js')) continue;
    const text = buf.toString('utf8');
    // Every chunk a chunk imports was built beside it.
    for (const im of text.matchAll(/\bimport\s*(?:[^'"()]*?\bfrom\s*)?\(?\s*["'](\.\/[^"']+)["']/g)) {
      if (!existsSync(join(assets, im[1]!))) problems.push(`assets/${f} imports a missing chunk: ${im[1]}`);
    }
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bsk-[A-Za-z0-9_-]{24,}/.test(text))
      problems.push(`assets/${f} appears to hold a secret`);
  }
  for (const f of readdirSync(dist)) if (f.startsWith('.')) problems.push(`a hidden file is shipped: ${f}`);
  if (out.gzip > BUDGET_GZIP)
    problems.push(`the bundle is ${out.gzip} bytes gzipped, over its budget of ${BUDGET_GZIP}`);
  if (out.raw > BUDGET_RAW) problems.push(`the bundle is ${out.raw} bytes, over its budget of ${BUDGET_RAW}`);

  let vercel: VercelConfig;
  try {
    vercel = JSON.parse(vercelJson) as VercelConfig;
  } catch {
    problems.push('vercel.json is not JSON');
    return out;
  }
  if (vercel.buildCommand !== 'npm run build') problems.push('vercel.json does not build with npm run build');
  if (vercel.outputDirectory !== 'dist') problems.push('vercel.json does not serve dist');
  const page = vercel.headers?.find((h) => h.source === '/(.*)')?.headers ?? [];
  const header = (k: string) => page.find((h) => h.key.toLowerCase() === k.toLowerCase())?.value;
  const csp = header('Content-Security-Policy');
  if (!csp) problems.push('vercel.json sends no Content-Security-Policy');
  else {
    const directive = (d: string) => new RegExp(`(?:^|;)\\s*${d}\\s([^;]*)`).exec(csp)?.[1];
    const scripts = directive('script-src') ?? directive('default-src') ?? '*';
    if (/unsafe-inline|unsafe-eval|\*|https?:/.test(scripts))
      problems.push(`the content security policy lets other scripts run: script-src ${scripts.trim()}`);
    for (const d of ["object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'"])
      if (!csp.includes(d)) problems.push(`the content security policy lacks ${d}`);
  }
  if (header('X-Content-Type-Options') !== 'nosniff') problems.push('vercel.json does not send nosniff');
  const cache =
    vercel.headers?.find((h) => h.source === '/assets/(.*)')?.headers.find((h) => h.key === 'Cache-Control')
      ?.value ?? '';
  if (!cache.includes('immutable')) problems.push('hashed assets are not cached as immutable');
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const r = verifyRelease(join(root, 'dist'), readFileSync(join(root, 'vercel.json'), 'utf8'));
  const kb = (n: number) => `${(n / 1000).toFixed(1)} kB`;
  console.log(
    `bundle: ${kb(r.raw)} (budget ${kb(BUDGET_RAW)}), ${kb(r.gzip)} gzipped (budget ${kb(BUDGET_GZIP)})`,
  );
  if (r.problems.length) {
    console.error(`Release check failed:\n${r.problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log(
    'Release check passed: the build is whole, within budget, and served under the production headers.',
  );
}
