/** Versions are embedded in saves and replay transcripts so old data can be migrated or rejected. */
export const SCHEMA_VERSION = 1;
export const RULES_VERSION = '0.4.2';
export const CONTENT_VERSION = '0.3.0';

/** Time: one authoritative tick = 100 ms of ACTIVE simulation. 600 ticks = 60.0 s. */
export const TICKS_PER_SECOND = 10;
export const EPOCH_SECONDS = 60;
export const EPOCH_TICKS = EPOCH_SECONDS * TICKS_PER_SECOND;

/** Warnings fire this many ticks before the cataclysm (25 s, 15 s, 5 s). */
export const FORECAST_LEAD_TICKS = [250, 150, 50] as const;

/** Fixed-point scale for resources: stored value = displayed value * UNIT. */
export const UNIT = 1000;

/** Logical grid. Rendered as continuous terrain; cells are never drawn as visible squares. */
export const GRID_W = 32;
export const GRID_H = 32;
export const CELLS = GRID_W * GRID_H;

/** Every scalar world field (fertility, forest, ...) is an integer 0..1000. */
export const FIELD_MAX = 1000;

/** Height is stored in 1/100 of a cell width. 100 = one cell tall. */
export const HEIGHT_UNIT = 100;

export const MAX_PLAN_SLOTS = 3;
export const MAX_QUEUE = 16;
export const MAX_EVENTS = 500;
export const MIN_FOUNDERS = 3;
