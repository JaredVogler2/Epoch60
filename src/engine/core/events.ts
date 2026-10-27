import { MAX_EVENTS } from './constants';
import type { Campaign, SimEvent } from './types';

export function emit(c: Campaign, e: Omit<SimEvent, 'tick' | 'epoch'>): void {
  c.events.push({ tick: c.tick, epoch: c.epoch, ...e });
  if (c.events.length > MAX_EVENTS) {
    // Trim the oldest non-important events first.
    const keep: SimEvent[] = [];
    let drop = c.events.length - MAX_EVENTS;
    for (const ev of c.events) {
      if (drop > 0 && !ev.important) {
        drop--;
        continue;
      }
      keep.push(ev);
    }
    c.events = keep.slice(-MAX_EVENTS);
  }
}
