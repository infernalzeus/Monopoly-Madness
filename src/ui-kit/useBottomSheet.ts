import { useEffect, useRef, useState } from 'react';
export interface BottomSheetOptions {
  /** Mount/open state supplied by the owner. */ open?: boolean;
  /** Escape/close callback; absence makes a required decision non-dismissible. */ onDismiss?: () => void;
  /** Trap focus when true; use false for a nonmodal desktop side panel. */ modal?: boolean;
}
/** Focus entry, focus loop, Escape and restoration; scoped to a single mounted dialog. */
export function useBottomSheet({ open = true, onDismiss, modal = true }: BottomSheetOptions = {}) {
  const ref = useRef<HTMLDivElement>(null); const dismissRef = useRef(onDismiss); dismissRef.current = onDismiss;
  const [isMobile, setMobile] = useState(true);
  useEffect(() => { const media = window.matchMedia('(max-width: 639px)'); const update = () => setMobile(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  useEffect(() => {
    if (!open || !ref.current) return;
    const node = ref.current; const previous = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')).filter(e => e.getClientRects().length > 0 && !e.closest('[hidden]'));
    const first = () => (focusables()[0] ?? node).focus({ preventScroll: true });
    if (modal) node.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissRef.current) { event.preventDefault(); dismissRef.current(); }
      if (!modal || event.key !== 'Tab') return;
      const items = focusables(); const current = document.activeElement; const index = items.indexOf(current as HTMLElement);
      if (!items.length) { event.preventDefault(); node.focus(); return; }
      if (event.shiftKey && index <= 0) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && (index === -1 || index === items.length - 1)) { event.preventDefault(); first(); }
    };
    const onFocus = (event: FocusEvent) => { if (modal && !node.contains(event.target as Node)) first(); };
    // No body scroll lock: players must still be able to scroll the page (board, portfolio) behind a pending decision.
    document.addEventListener('keydown', onKey); document.addEventListener('focusin', onFocus);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('focusin', onFocus); if (modal) { if (previous?.isConnected) previous.focus({ preventScroll: true }); } };
  }, [open, modal]);
  return { ref, isMobile };
}
