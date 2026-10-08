import { createPortal } from 'react-dom';
import React, { useId, useRef, useState, type CSSProperties } from 'react';
import { CurrencyAmount, formatCurrency } from '../CurrencyAmount';
import { readableTextOn } from '../PlayerIdentity';
import { Icon } from '../icons';
import { CityArt, groupColors, type ArtVariant } from './CityArt';
import { flavourFor } from './flavour';
import { InspectView } from './InspectView';
import type { PropertyCardProps } from './types';
export type { PropertyCardProps, CardAction } from './types';
export function cardDescription({ property:p, owner, rentNow, hidden, hasMonopoly, teamBoosted }: PropertyCardProps): string {
  if(hidden)return 'Undiscovered property. Identity hidden.';
  return `${p.name}. ${p.colorGroup??p.type}. ${p.isInactive?'Neutral; no rent':p.isOwned?`Owned ${owner?.isYou?'by you':`by ${owner?.name??p.owner??'unknown owner'}`}`:'Unowned'}. Rent now ${p.isInactive||p.isMortgaged?'none':typeof rentNow==='number'?formatCurrency(rentNow,false):rentNow}. ${[p.isMortgaged?'Mortgaged; no rent':'',p.isInAuction?'Auction':'',hasMonopoly?'Monopoly':'',teamBoosted?'Team boosted':'',p.hasHotel?'Hotel':`${p.houses} houses`].filter(Boolean).join('. ')}`;
}
/** Presentational face, shared by the trigger and inspect view; no event handling. */
export function PropertyFace(props: PropertyCardProps) {
  const {property:p,size='hand',owner,rentNow,hasMonopoly,teamBoosted,hidden,selected,mortgageAmount}=props;
  const variant:ArtVariant=p.type==='railroad'?'railroad':p.type==='utility'?'utility':p.colorGroup&&p.colorGroup in groupColors?p.colorGroup as ArtVariant:'brown';
  const color=p.isInactive?'#cbd5e1':groupColors[variant];
  const labels=p.type==='railroad'?['1 railroad','2 railroads','3 railroads','4 railroads']:['Rent','With 1 house','With 2 houses','With 3 houses','With 4 houses','With hotel'];
  return <div className={`mma-ui mmc-face mmc-${size} ${p.isMortgaged?'mmc-mortgaged':''} ${p.isInactive?'mmc-neutral':''} ${hasMonopoly?'mmc-monopoly':''} ${p.isInAuction?'mmc-auction':''}`} style={{'--mmc-group':color,'--mmc-group-ink':readableTextOn(color)} as CSSProperties}>
    {hidden?<div className="mmc-back"><Icon name="bank" size={32}/><strong aria-hidden="true">?</strong><span>Undiscovered</span></div>:<>
      <div className="mmc-banner"><span>{(p.colorGroup??p.type).replace(/([a-z])([A-Z])/g, '$1 $2')}</span><strong>{p.name}</strong>{selected&&<span className="mmc-selected"><Icon name="check" size={16}/>Selected</span>}</div>
      <CityArt variant={variant} city={p.name}/>
      <div className="mmc-content"><div className="mmc-badges">{p.isInactive?<span>NEUTRAL</span>:p.isMortgaged?<span><Icon name="mortgage" size={14}/>MORTGAGED</span>:null}{p.isInAuction&&<span><Icon name="auction" size={14}/>AUCTION</span>}{hasMonopoly&&<span>MONOPOLY</span>}{teamBoosted&&<span><Icon name="team" size={14}/>TEAM BOOSTED</span>}</div>
      {p.type==='property'&&<div className="mmc-buildings"><Icon name={p.hasHotel?'hotel':'house'} size={16}/>{p.hasHotel?'Hotel':`${p.houses} / 4 houses`}</div>}
      {size==='mini'&&<p className="mmc-mini-owner">{p.isInactive?'Neutral':p.isOwned?owner?.isYou?'You':owner?.name??p.owner??'Owned':'Unowned'}</p>}
      {size!=='mini'&&<><div className="mmc-rent"><span>Rent now</span><strong>{p.isInactive?'No rent · neutral':p.isMortgaged?'No rent · mortgaged':typeof rentNow==='number'?<CurrencyAmount amount={rentNow}/>:rentNow}</strong></div><p className="mmc-owner">{owner?.icon&&<span aria-hidden="true">{owner.icon} </span>}{p.isInactive?'Historical owner':p.isOwned?owner?.isYou?'Owned by you':'Owned by':'Unowned'}{p.isOwned&&` · ${owner?.name??p.owner??'Unknown'}`}{owner?.teamName&&` · ${owner.teamName}`}</p></>}
      {size==='full'&&<><dl className="mmc-rent-table" aria-label="Full rent table">{p.type==='utility'?<><dt>Utility rule</dt><dd>{typeof rentNow==='string'?rentNow:'See current dice-based rent above'}</dd></>:labels.map((label,i)=><React.Fragment key={label}><dt>{label}</dt><dd>{p.rent[i]===undefined?'Not provided':<CurrencyAmount amount={p.rent[i]}/>}</dd></React.Fragment>)}</dl>{p.type==='property'&&<p className="mmc-rule">Monopoly doubles unimproved rent. Mortgaged and neutral properties collect no rent.</p>}<dl className="mmc-deed-values"><dt>Mortgage value</dt><dd><CurrencyAmount amount={mortgageAmount}/></dd>{p.type==='property'&&<><dt>Base house cost</dt><dd>{p.houseCost===undefined?'Not provided':<CurrencyAmount amount={p.houseCost}/>}</dd><dt>Hotel cost</dt><dd>{p.hotelCost===undefined?'Not provided':<CurrencyAmount amount={p.hotelCost}/>}</dd></>}<dt>Market value</dt><dd><CurrencyAmount amount={p.currentValue}/></dd></dl><p className="mmc-flavour">“{flavourFor(p.name)}”</p></>}
      </div></>}
  </div>;
}
export function PropertyCard(props: PropertyCardProps) {
  const { size='hand',onSelect,initiallyInspecting=false,onInspectChange,hidden,selectionDisabledReason }=props;
  const reasonId=useId();
  const [inspect,setInspect]=useState(initiallyInspecting);const rect=useRef<DOMRect|null>(null);const trigger=useRef<HTMLButtonElement>(null);
  const close=()=>{setInspect(false);onInspectChange?.(false);};
  return <>{size==='full'?<article className="mmc-card-static" aria-label={cardDescription(props)}><PropertyFace {...props}/></article>:<button ref={trigger} type="button" className="mmc-card-trigger" disabled={hidden||!!selectionDisabledReason} aria-describedby={selectionDisabledReason?reasonId:undefined} aria-label={cardDescription(props)} aria-pressed={onSelect?!!props.selected:undefined} aria-haspopup={onSelect||hidden?undefined:'dialog'} onClick={()=>{if(onSelect){onSelect();return;}if(hidden)return;rect.current=trigger.current?.getBoundingClientRect()??null;setInspect(true);onInspectChange?.(true);}}><PropertyFace {...props}/></button>}{selectionDisabledReason&&<p id={reasonId} className="mmc-lock"><Icon name="jail" size={16}/>Locked · {selectionDisabledReason}</p>}{inspect&&!hidden&&createPortal(<InspectView {...props} origin={rect.current} onClose={close}/>,document.body)}</>;
}

