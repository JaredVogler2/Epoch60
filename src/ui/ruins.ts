import { BUILDINGS, UNIT, getScenario, repairBlocked, repairCost } from '../engine';
import type { Campaign, Structure } from '../engine';
import { ROMAN } from './format';

/**
 * What a ruin can tell the player who presses it: when and by whom it was built, what it was for, how it fell, and
 * exactly what clearing or restoring it would do now. Every line is read from the engine's own state and rules
 * (provenance, salvage, `repairBlocked`, `repairCost`), never written separately from them.
 */
export interface RuinFacts {
  built: string;
  purpose: string;
  fell: string;
  clear: string;
  restore: string;
}

/** Provenance lines that say how a building came down (written by collapse, decay, founding and clearing). */
const FALL = /destroyed by|crumbled|never finished|Abandoned/;
/** ... and the ones that say a catastrophe left it standing but broken. */
const DAMAGE = /was damaged by|weathered into disrepair|weakened before/;

/** Share of the build work an excavated ruin still needs once its restoration is ordered (`campaign.ts`: 35% done). */
const RESTORE_LEFT = 65;

/** A gain in whole units as the HUD counts them (floored), honest about scraps below one unit. */
function amount(n: number, what: string): string {
  return n < UNIT ? `less than 1 ${what}` : `${Math.floor(n / UNIT)} ${what}`;
}

/** A price in whole units as every cost in the UI shows it (rounded up: what you need to afford it). */
function price(n: number, what: string): string {
  return `${Math.ceil(n / UNIT)} ${what}`;
}

export function ruinFacts(c: Campaign, s: Structure): RuinFacts {
  const d = BUILDINGS[s.kind];
  const spec = getScenario(c.scenario).epochs[s.originEpoch];
  const built =
    s.originEpoch === c.epoch
      ? `Built in this age.`
      : `Built in the ${spec?.ageName ?? `age ${s.originEpoch + 1}`} by ${spec?.name ?? 'an earlier people'} (age ${ROMAN[s.originEpoch] ?? s.originEpoch + 1}).`;
  // How it came down. A building that crumbled with time is introduced by the catastrophe that broke it (unless it
  // was repaired since); one destroyed outright, abandoned or never finished needs no prelude.
  let at = s.provenance.length - 1;
  while (at >= 0 && !FALL.test(s.provenance[at]!)) at--;
  let broken = at >= 0 && s.provenance[at]!.includes('crumbled') ? at - 1 : -1;
  while (broken >= 0 && !DAMAGE.test(s.provenance[broken]!))
    broken = s.provenance[broken]!.startsWith('Repaired') ? -1 : broken - 1;
  const broke = broken >= 0 ? s.provenance[broken] : undefined;
  const fell =
    at < 0
      ? s.cause === 'decay'
        ? 'It crumbled with the centuries.'
        : 'How it fell is not recorded.'
      : broke
        ? `${broke} ${s.provenance[at]}`
        : s.provenance[at]!;

  const salvage = s.salvage.timber + s.salvage.stone > 0;
  const clear = salvage
    ? `Clearing it gives ${[
        s.salvage.timber > 0 ? amount(s.salvage.timber, 'timber') : '',
        s.salvage.stone > 0 ? amount(s.salvage.stone, 'stone') : '',
      ]
        .filter(Boolean)
        .join(' and ')} and frees the ground.`
    : 'Clearing it frees the ground; nothing worth salvaging is left.';

  let restore: string;
  const why = repairBlocked(c, s);
  if (!why || why.code === 'limit_reached') {
    const cost = repairCost(s);
    const costs = [
      cost.food > 0 ? price(cost.food, 'food') : '',
      cost.timber > 0 ? price(cost.timber, 'timber') : '',
      cost.stone > 0 ? price(cost.stone, 'stone') : '',
    ]
      .filter(Boolean)
      .join(', ');
    restore = `Restoring it costs ${costs || 'nothing'}; builders finish the last ${RESTORE_LEFT}% and it works again as a ${d.name}.`;
    if (d.heritage && s.originEpoch < c.epoch)
      restore += ' Standing at the end, it counts as a landmark from an earlier age.';
    if (d.retains > 0) restore += ' Restored, it carries technologies through the next collapse again.';
    if (why) restore += ` Not now: ${why.message.toLowerCase()}.`;
  } else if (s.kind === 'hearth') {
    restore =
      'An old hearth cannot be relit. To keep a hearth, found the next age within a cell of one still standing.';
  } else if (d.material === 'thatch') {
    restore = 'Thatch rots: nothing of it can be restored, only cleared.';
  } else if (!s.excavated) {
    restore = 'To restore it, excavate it first between ages.';
  } else {
    restore = why.message;
  }
  return { built, purpose: d.blurb, fell, clear, restore };
}
