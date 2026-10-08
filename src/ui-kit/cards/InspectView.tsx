import React, { useEffect, useId, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { useBottomSheet } from '../useBottomSheet';
import { useReducedMotion } from '../useReducedMotion';
import { KitButton } from '../primitives';
import { Icon } from '../icons';
import { PropertyFace } from './PropertyCard';
import type { PropertyCardProps } from './types';
export interface InspectViewProps extends PropertyCardProps {
  /** Source card bounds captured on the tap/click, for transform-only FLIP. */ origin?: DOMRect | null;
  /** Unmount inspect and restore trigger focus. */ onClose: () => void;
}
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
export function InspectView({ origin,onClose,actions=[],onMoveLeft,onMoveRight,...props }: InspectViewProps) {
  const id=useId();const {ref}=useBottomSheet({onDismiss:onClose});const face=useRef<HTMLDivElement>(null);const reduced=useReducedMotion();
  useClientLayoutEffect(()=>{const node=face.current;if(!node||!origin||reduced)return;const to=node.getBoundingClientRect();node.style.setProperty('--mmc-dx',`${origin.left-to.left}px`);node.style.setProperty('--mmc-dy',`${origin.top-to.top}px`);node.style.setProperty('--mmc-sx',`${origin.width/to.width}`);node.style.setProperty('--mmc-sy',`${origin.height/to.height}`);node.classList.add('mmc-expand');},[origin,reduced]);
  return <div className="mma-ui mmc-inspect-layer"><section ref={ref} className="mmc-inspect" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}><header className="mmc-inspect-header"><h2 id={id}>Inspect {props.property.name}</h2><KitButton aria-label={`Close ${props.property.name} inspect`} onClick={onClose}><Icon name="close"/></KitButton></header><div className="mmc-inspect-body"><div ref={face} style={{'--mmc-dx':'0px','--mmc-dy':'0px','--mmc-sx':1,'--mmc-sy':1} as CSSProperties}><PropertyFace {...props} size="full"/></div></div><footer className="mmc-inspect-footer">{actions.map(a=><KitButton key={a.id} variant={a.id.startsWith('build')?'primary':'secondary'} onClick={a.onAction} disabledReason={a.disabledReason}>{a.label}</KitButton>)}{(onMoveLeft||onMoveRight)&&<div className="mma-actions"><KitButton disabledReason={!onMoveLeft?'First card.':undefined} onClick={onMoveLeft}>Move left</KitButton><KitButton disabledReason={!onMoveRight?'Last card.':undefined} onClick={onMoveRight}>Move right</KitButton></div>}</footer></section></div>;
}
