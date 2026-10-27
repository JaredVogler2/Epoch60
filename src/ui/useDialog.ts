import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal behaviour for an overlay: focus moves to its `[data-autofocus]` control (or the first control) when it opens,
 * Tab and Shift+Tab stay inside it, Escape runs `onEscape` if given, and focus returns to where it was on close.
 * Listens in the capture phase so the game's global hotkeys never act behind the dialog.
 */
export function useDialog(
  ref: RefObject<HTMLElement | null>,
  onEscape?: () => void,
  trap = true,
  open = true,
): void {
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });
  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    const before = document.activeElement as HTMLElement | null;
    const first =
      el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escape.current) {
        e.preventDefault();
        e.stopPropagation();
        escape.current();
        return;
      }
      if (!trap || e.key !== 'Tab') return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!items.length) return;
      const a = items[0]!;
      const z = items[items.length - 1]!;
      const active = document.activeElement;
      if (!el.contains(active)) {
        e.preventDefault();
        a.focus();
      } else if (e.shiftKey && active === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && active === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (before && before !== document.body && document.contains(before))
        before.focus({ preventScroll: true });
    };
  }, [ref, trap, open]);
}
