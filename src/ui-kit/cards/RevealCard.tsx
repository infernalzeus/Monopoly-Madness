import React, { useEffect, useRef, useState } from 'react';
import { CurrencyAmount } from '../CurrencyAmount';
import { KitButton } from '../primitives';
import { Icon, type IconName } from '../icons';
export type RevealKind='chance'|'community'|'go-to-jail'|'free-parking'|'pass-go';
export interface RevealCardProps {
  /** Presentation category. */ kind: RevealKind;
  /** Actual outcome heading from adapter. */ title: string;
  /** Signed outcome amount; omit when no cash changes. */ amount?: number;
  /** Rule/breakdown strings supplied by adapter, never calculated here. */ lines: string[];
  /** Optional double-roll jail-card award or other extra. */ perk?: string;
  /** Authorized resolve callback. */ onContinue: () => void;
  /** Collect/Pay/Continue label supplied by adapter. */ continueLabel: string;
  /** Explicit permission/write reason. */ disabledReason?: string;
  /** Optional controlled front/back state; defaults to back. */ revealed?: boolean;
  /** Optional observer/sound hook called once when front is revealed. */ onReveal?: () => void;
}
const icons:Record<RevealKind,IconName>={chance:'dice',community:'bank','go-to-jail':'jail','free-parking':'bank','pass-go':'arrow'};
export function RevealCard({kind,title,amount,lines,perk,onContinue,continueLabel,disabledReason,revealed,onReveal}:RevealCardProps){
  const [local,setLocal]=useState(false);const front=revealed??local;const announced=useRef(false);const callback=useRef(onReveal);callback.current=onReveal;
  useEffect(()=>{if(front&&!announced.current){announced.current=true;callback.current?.();}},[front]);
  return <section className={`mma-ui mmc-reveal mmc-reveal-${kind}`} aria-label={`${kind} card`}><div className={`mmc-flip ${front?'mmc-is-front':''}`}><div className="mmc-reveal-back" aria-hidden={front}><Icon name={icons[kind]} size={56}/><h2>{kind==='community'?'Community Chest':kind.replace(/-/g,' ')}</h2>{!front&&<KitButton variant="primary" onClick={()=>setLocal(true)} disabledReason={revealed===false?'Reveal is controlled by the owner.':undefined}>Reveal card</KitButton>}</div><div className="mmc-reveal-front" aria-hidden={!front}><p className="mmc-event-banner"><Icon name={icons[kind]}/>{kind==='community'?'COMMUNITY CHEST':kind.replace(/-/g,' ').toUpperCase()}</p><h2>{title}</h2>{amount!==undefined&&<div className="mma-money"><CurrencyAmount amount={amount} signed/></div>}{lines.map((line,i)=><p key={i}>{line}</p>)}{perk&&<p className="mmc-perk"><Icon name="key"/>{perk}</p>}</div></div>{front&&<footer className="mmc-reveal-footer"><KitButton variant="primary" onClick={onContinue} disabledReason={disabledReason}>{continueLabel}</KitButton></footer>}</section>;
}

