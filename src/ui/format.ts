import { UNIT } from '../engine';

export function units(v: number): string {
  return String(Math.floor(v / UNIT));
}

export function clock(secondsLeft: number): string {
  const s = Math.max(0, secondsLeft);
  const whole = Math.floor(s);
  const tenth = Math.floor((s - whole) * 10);
  return `${whole.toString().padStart(2, '0')}.${tenth}`;
}

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function signed(n: number, digits = 1): string {
  const v = Math.round(n * 10 ** digits) / 10 ** digits;
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;
}
