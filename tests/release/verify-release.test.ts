import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUDGET_GZIP, verifyRelease } from '../../scripts/verify-release';

const vercel = readFileSync('vercel.json', 'utf8');
let made: string[] = [];
afterEach(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
  made = [];
});

const page = (head: string) =>
  `<!doctype html><html><head><title>EPOCH</title>${head}</head><body><div id="root"></div></body></html>`;
const WHOLE = page(
  '<script type="module" crossorigin src="/assets/index-a.js"></script><link rel="stylesheet" href="/assets/index-c.css">',
);

/** A small built game: its page, an entry chunk importing a second chunk, and a stylesheet. */
function dist(over: { html?: string; files?: Record<string, string> } = {}): string {
  const d = mkdtempSync(join(tmpdir(), 'epoch60-dist-'));
  made.push(d);
  mkdirSync(join(d, 'assets'));
  const files = {
    'index-a.js': 'import{t}from"./lib-b.js";t();',
    'lib-b.js': 'export const t=()=>1;',
    'index-c.css': 'body{margin:0}',
    ...over.files,
  };
  for (const [f, text] of Object.entries(files)) writeFileSync(join(d, 'assets', f), text);
  writeFileSync(join(d, 'index.html'), over.html ?? WHOLE);
  return d;
}
const problems = (d: string, v = vercel) => verifyRelease(d, v).problems;

describe('the release check', () => {
  it('passes a whole build served under the production headers', () => {
    expect(problems(dist())).toEqual([]);
  });

  it('finds what the page or a chunk needs that is missing, inline or from another origin', () => {
    expect(problems(dist({ html: page('<script type="module" src="/assets/gone.js"></script>') }))).toEqual([
      'index.html references a missing file: /assets/gone.js',
    ]);
    expect(problems(dist({ html: page('<script>alert(1)</script>') }))).toEqual([
      'index.html has an inline script',
    ]);
    expect(problems(dist({ html: page('<style>body{}</style>') }))).toEqual([
      'index.html has an inline style',
    ]);
    expect(problems(dist({ html: page('<script src="https://cdn.example.com/x.js"></script>') }))).toEqual([
      'index.html loads from another origin: https://cdn.example.com/x.js',
    ]);
    expect(problems(dist({ html: '<html><body></body></html>' }))).toEqual([
      'index.html has no #root element',
      'index.html has no title',
    ]);
    expect(problems(dist({ files: { 'index-a.js': 'import{t}from"./lost-z.js";t();' } }))).toEqual([
      'assets/index-a.js imports a missing chunk: ./lost-z.js',
    ]);
    expect(problems(dist({ files: { 'index-a.js.map': '{}' } }))).toEqual([
      'a source map is shipped: assets/index-a.js.map',
    ]);
    expect(problems(dist({ files: { 'lib-b.js': 'const k="-----BEGIN RSA PRIVATE KEY-----";' } }))).toEqual([
      'assets/lib-b.js appears to hold a secret',
    ]);
    const empty = mkdtempSync(join(tmpdir(), 'epoch60-dist-'));
    made.push(empty);
    expect(problems(empty)).toEqual(['dist/index.html is missing (run npm run build)']);
  });

  it('holds the bundle to its budget', () => {
    // Random text barely compresses: about 700 kB gzipped, over the budget, while the raw size stays within its own.
    const noise = randomBytes(700_000).toString('base64');
    const r = verifyRelease(dist({ files: { 'lib-b.js': `export const t=()=>"${noise}";` } }), vercel);
    expect(r.gzip).toBeGreaterThan(BUDGET_GZIP);
    expect(r.problems).toEqual([`the bundle is ${r.gzip} bytes gzipped, over its budget of ${BUDGET_GZIP}`]);
  });

  it('insists on the production headers', () => {
    const v = JSON.parse(vercel) as { headers: { source: string; headers: { key: string }[] }[] };
    const without = (key: string) =>
      JSON.stringify({
        ...v,
        headers: v.headers.map((h) => ({ ...h, headers: h.headers.filter((x) => x.key !== key) })),
      });
    const d = dist();
    expect(problems(d, without('Content-Security-Policy'))).toEqual([
      'vercel.json sends no Content-Security-Policy',
    ]);
    expect(problems(d, vercel.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"))).toEqual([
      "the content security policy lets other scripts run: script-src 'self' 'unsafe-inline'",
    ]);
    expect(problems(d, vercel.replace("script-src 'self'; ", ''))).toEqual([]);
    expect(problems(d, vercel.replace("default-src 'self'; script-src 'self'; ", ''))).toEqual([
      'the content security policy lets other scripts run: script-src *',
    ]);
    expect(problems(d, vercel.replace("; frame-ancestors 'none'", ''))).toEqual([
      "the content security policy lacks frame-ancestors 'none'",
    ]);
    expect(problems(d, without('X-Content-Type-Options'))).toEqual(['vercel.json does not send nosniff']);
    expect(problems(d, without('Cache-Control'))).toEqual(['hashed assets are not cached as immutable']);
    expect(problems(d, vercel.replace('"outputDirectory": "dist"', '"outputDirectory": "build"'))).toEqual([
      'vercel.json does not serve dist',
    ]);
    expect(problems(d, '{')).toEqual(['vercel.json is not JSON']);
  });
});
