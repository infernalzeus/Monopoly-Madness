import React, { type ReactNode, useId } from 'react';
import { useBottomSheet } from '../useBottomSheet';
import { Glyph } from './shared';
export interface StageFrameProps {
    /** Kind-specific frame accent. */ kind: 'rent' | 'card' | 'purchase' | 'jail' | 'auction' | 'own-property';
    /** Accessible decision title. */ title: string;
    /** Optional explanation. */ subtitle?: string;
    /** Scrollable body, never a nested modal. */ children: ReactNode;
    /** Sticky actions supplied by caller. */ footer: ReactNode;
    /** Optional Escape/close action; omit for mandatory decisions. */ onDismiss?: () => void;
    /** Inline decoration inside an existing ActionStage; avoids a second dialog/focus owner. */ inline?: boolean;
}
/** Modal shell never changes body overflow or locks page scrolling. Render one decision owner. */
export function StageFrame({ inline = false, ...props }: StageFrameProps) { return inline ? <StageContents {...props}/> : <ModalStage {...props}/>; }
function ModalStage(props: Omit<StageFrameProps, 'inline'>) { const { ref } = useBottomSheet({ onDismiss: props.onDismiss }); const id = useId(); return <div className="mp-modal-position"><div ref={ref} className="mp-modal" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}><StageContents {...props} titleId={id}/></div></div>; }
function StageContents({ kind, title, subtitle, children, footer, onDismiss, titleId }: Omit<StageFrameProps, 'inline'> & {
    titleId?: string;
}) { return <section className={`mp-stage mp-kind-${kind}`}><header className="mp-stage-header"><div className="mp-grow"><p className="mp-eyebrow">{kind.replace('-', ' ')}</p><h2 id={titleId}>{title}</h2>{subtitle && <p className="mp-muted">{subtitle}</p>}</div>{onDismiss && <button type="button" className="mp-button mp-close" aria-label={`Close ${title}`} onClick={onDismiss}><Glyph name="close"/></button>}</header><div className="mp-stage-body">{children}</div><footer className="mp-stage-footer">{footer}</footer></section>; }
