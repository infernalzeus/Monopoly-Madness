import React, { useId, type ReactNode } from 'react';
import { useBottomSheet } from './useBottomSheet';
import { SheetHeading } from './primitives';
export interface ActionStageProps {
  /** Priority-selected action. Caller renders exactly one stage at a time. */ kind: 'jail' | 'card' | 'rent' | 'purchase' | 'auction' | 'own-property';
  /** Accessible panel title. */ title: string;
  /** Optional contextual explanation. */ subtitle?: string;
  /** Scrollable content; not another modal. */ children: ReactNode;
  /** Sticky primary/secondary action row. */ footer: ReactNode;
  /** Optional close/Escape action. Omit for mandatory decisions. */ onDismiss?: () => void;
}
export function ActionStage({ kind, title, subtitle, children, footer, onDismiss }: ActionStageProps) {
  const titleId = useId(); const descriptionId = useId(); const { ref } = useBottomSheet({ onDismiss });
  return <div className="mma-ui mma-stage-frame"><div ref={ref} className="mma-stage" data-kind={kind} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={subtitle ? descriptionId : undefined} tabIndex={-1}>
    <SheetHeading title={title} titleId={titleId} onClose={onDismiss} />{subtitle && <p className="mma-stage-subtitle" id={descriptionId}>{subtitle}</p>}
    <div className="mma-stage-body">{children}</div><footer className="mma-stage-footer">{footer}</footer>
  </div></div>;
}
