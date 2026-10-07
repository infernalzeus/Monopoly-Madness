import React, { useId, type ReactNode } from 'react';
import { useBottomSheet } from './useBottomSheet';
import { SheetHeading } from './primitives';
export interface SheetShellProps {
  /** Accessible title. */ title: string;
  /** Controlled visibility. */ open?: boolean;
  /** Close callback. */ onClose?: () => void;
  /** Body, no nested dialog. */ children: ReactNode;
  /** Optional sticky bottom actions. */ footer?: ReactNode;
}
/** Phone modal bottom sheet, desktop nonmodal side panel. Mount one mobile sheet at a time. */
export function SheetShell({ title, open = true, onClose, children, footer }: SheetShellProps) {
  const id = useId(); const { isMobile } = useBottomSheet({ open: false });
  const { ref } = useBottomSheet({ open, onDismiss: onClose, modal: isMobile });
  if (!open) return null;
  return <div className="mma-ui mma-sheet-frame"><div ref={ref} className="mma-sheet" role={isMobile ? 'dialog' : 'complementary'} aria-modal={isMobile ? true : undefined} aria-labelledby={id} tabIndex={-1}><SheetHeading title={title} titleId={id} onClose={onClose} /><div className="mma-stage-body">{children}</div>{footer && <footer className="mma-stage-footer">{footer}</footer>}</div></div>;
}
