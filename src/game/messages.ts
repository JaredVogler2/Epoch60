import type { ActionResult, ErrorCode } from '../engine';

const TEXT: Record<ErrorCode, string> = {
  wrong_phase: 'Not possible right now.',
  unknown_kind: 'That cannot be built.',
  locked_age: 'That belongs to a later age.',
  locked_tech: 'You have not discovered the knowledge for that yet.',
  out_of_bounds: 'That is outside the valley.',
  on_water: 'Water blocks that site.',
  overlap: 'Something is already there.',
  too_steep: 'Too steep to level.',
  not_enough: 'Not enough resources.',
  need_deposit: 'Needs a stone outcrop underfoot.',
  need_forest: 'Needs standing forest nearby.',
  need_river: 'Must span the river.',
  need_hearth_access: 'Not connected to your hearth.',
  unreachable: 'Your people cannot walk there — no ford or bridge.',
  limit_reached: 'You already have as many as you can keep.',
  queue_full: 'Too many orders waiting.',
  no_such_structure: 'That building is gone.',
  bad_target: 'That is not a valid target.',
  already_done: 'Already done.',
  plan_slots_full: 'Your three opening plans are used. Begin the epoch, or withdraw one.',
  no_slots: 'No slots left this time.',
  tech_known: 'Already discovered.',
  tech_locked: 'Needs earlier knowledge first.',
  research_busy: 'Your scholars are already working on something.',
  too_late: 'Too late — the epoch is over.',
  invalid_choice: 'That choice is not available.',
  game_over: 'The story is over.',
};

export function explain(r: ActionResult): string {
  if (r.ok) return '';
  const base = r.message && r.message !== r.code ? r.message : TEXT[r.code];
  const h = r.hint;
  if (r.code === 'not_enough' && h) {
    const parts = Object.entries(h).map(([k, v]) => `${v} more ${k}`);
    return `Need ${parts.join(', ')}.`;
  }
  return TEXT[r.code] ?? base;
}

export function reasonShort(code: ErrorCode): string {
  return TEXT[code] ?? code;
}
