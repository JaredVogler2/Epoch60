import { deserialize } from '../engine';
import type { Campaign } from '../engine';
import { clearBranchPoints, loadBranchTag, saveBranchTag } from './branches';
import { loadCodex, mergeCodex, sanitizeCodex, saveCodex } from './codex';
import type { CodexEntry } from './codex';
import { dailyRun, loadRuns, mergeRuns, sanitizeRuns, saveRuns } from './modes';
import type { RunCard } from './modes';
import { loadDailyTag, loadSaveText, saveDailyTag, writeSaveText } from './persist';

/**
 * A backup: everything this browser keeps of a player's EPOCH (the saved lineage, the Codex and the run cards) as one
 * JSON file to keep, or to carry to another browser or device. Nothing is ever sent anywhere, and settings stay with the
 * device. A backup is untrusted input like any stored data: on import the lineage must read back whole (the engine's
 * save checks its shape and integrity), Codex entries and run cards are checked one by one and only good ones kept, and
 * nothing is written until the player has seen what the file holds.
 */

export const BACKUP_FORMAT = 'epoch60-backup';
export const BACKUP_VERSION = 1;
/** Far above any real backup: a twelve-age lineage's save is 0.6 million characters, forty run cards a few thousand. */
export const MAX_BACKUP_CHARS = 4_000_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** The saved lineage in the engine's own save format; absent when there is none (or it no longer reads back). */
  lineage?: {
    save: string;
    /** The Daily Ruins date it began on. */
    daily?: string;
    /** The age it was last replayed from (a branch, never ranked). */
    branch?: number;
  };
  codex: CodexEntry[];
  runs: RunCard[];
}

/** What a file holds, checked and ready to bring in. */
export interface BackupPlan {
  lineage: { campaign: Campaign; save: string; daily: string | null; branch: number | null } | null;
  /** The file had a lineage that does not read back (damaged, or from another version): it is left out. */
  lineageUnreadable: boolean;
  codex: CodexEntry[];
  runs: RunCard[];
  /** Codex entries and run cards in the file that this build cannot use, left out. */
  dropped: number;
}

export type BackupCheck = { ok: true; plan: BackupPlan } | { ok: false; reason: string };

export interface BackupResult {
  codex: CodexEntry[];
  runs: RunCard[];
  /** Feats and cards this browser did not hold before. */
  newFeats: number;
  newRuns: number;
  /** The backup's lineage is now the saved one (false: it had none, or storage refused it). */
  lineage: boolean;
}

/** The backup of what this browser holds now. A save that no longer reads back is left out rather than carried on. */
export function createBackup(): Backup {
  const out: Backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    codex: loadCodex(),
    runs: loadRuns(),
  };
  const save = loadSaveText();
  if (save) {
    try {
      const c = deserialize(save);
      const daily = loadDailyTag(c.seed, (day) => dailyRun(day).seed);
      const branch = loadBranchTag(c.seed);
      out.lineage = { save, ...(daily ? { daily } : {}), ...(branch !== null ? { branch } : {}) };
    } catch {
      /* unreadable: nothing worth carrying */
    }
  }
  return out;
}

export function backupFileName(d: Date): string {
  return `epoch60-backup-${d.toISOString().slice(0, 10)}.json`;
}

/** Hand the player a backup of what this browser holds now, as a file download. Returns what it holds. */
export function downloadBackup(): Backup {
  const b = createBackup();
  const url = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName(new Date());
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return b;
}

/** Read a file's text as a backup and say what it holds. Nothing is written. */
export function checkBackup(text: string): BackupCheck {
  const notOne = { ok: false as const, reason: 'That file is not an EPOCH backup.' };
  if (text.length > MAX_BACKUP_CHARS)
    return { ok: false, reason: 'That file is too large to be an EPOCH backup.' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return notOne;
  }
  if (!raw || typeof raw !== 'object' || (raw as { format?: unknown }).format !== BACKUP_FORMAT)
    return notOne;
  const b = raw as Record<string, unknown>;
  if (!Number.isInteger(b.version) || (b.version as number) < 1) return notOne;
  if ((b.version as number) > BACKUP_VERSION)
    return { ok: false, reason: 'That backup comes from a newer version of EPOCH.' };
  let lineage: BackupPlan['lineage'] = null;
  let lineageUnreadable = false;
  if (b.lineage !== undefined) {
    const l = b.lineage as Record<string, unknown> | null;
    try {
      if (!l || typeof l !== 'object' || typeof l.save !== 'string') throw new Error('no save');
      const campaign = deserialize(l.save);
      // Its companions are trusted only as far as they fit it, as when they are read from storage.
      const daily =
        typeof l.daily === 'string' && DATE_RE.test(l.daily) && dailyRun(l.daily).seed === campaign.seed
          ? l.daily
          : null;
      const branch =
        Number.isInteger(l.branch) && (l.branch as number) >= 0 && (l.branch as number) <= campaign.epoch
          ? (l.branch as number)
          : null;
      lineage = { campaign, save: l.save, daily, branch };
    } catch {
      lineageUnreadable = true;
    }
  }
  const codex = sanitizeCodex(b.codex);
  const runs = sanitizeRuns(b.runs);
  const count = (x: unknown) => (Array.isArray(x) ? x.length : 0);
  const dropped = count(b.codex) - codex.length + count(b.runs) - runs.length;
  return { ok: true, plan: { lineage, lineageUnreadable, codex, runs, dropped } };
}

/**
 * The branch mark a lineage brought back from a backup carries: its own if it was a branch already, else the age it was
 * in once it had begun. A backup could otherwise retry an age that was lost (export, lose, import, play again), which
 * is exactly what a branch is; like any branch, its feats count but its card is never ranked.
 */
export function importedBranch(lineage: NonNullable<BackupPlan['lineage']>): number | null {
  const c = lineage.campaign;
  const begun = c.epoch > 0 || c.actionLog.length > 0;
  return lineage.branch ?? (begun ? c.epoch : null);
}

/**
 * Bring a checked backup in. Its lineage replaces the saved one (with its Daily Ruins date and branch mark, see
 * `importedBranch`; the branch points of the lineage it replaces go with it). Its feats and cards join this browser's,
 * so nothing else is lost.
 */
export function applyBackup(plan: BackupPlan, have: { codex: CodexEntry[]; runs: RunCard[] }): BackupResult {
  const codex = mergeCodex(have.codex, plan.codex);
  const runs = mergeRuns(have.runs, plan.runs);
  saveCodex(codex);
  saveRuns(runs);
  let lineage = false;
  if (plan.lineage) {
    const { campaign, save, daily } = plan.lineage;
    lineage = writeSaveText(save);
    if (lineage) {
      saveDailyTag(campaign.seed, daily);
      clearBranchPoints();
      saveBranchTag(campaign.seed, importedBranch(plan.lineage));
    }
  }
  const before = new Set(have.runs.map((r) => r.id));
  return {
    codex,
    runs,
    newFeats: codex.length - have.codex.length,
    newRuns: runs.filter((r) => !before.has(r.id)).length,
    lineage,
  };
}
