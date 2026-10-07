import React, { type CSSProperties } from 'react';
import { Icon } from './icons';
/** Pick near-black or white ink using relative luminance, maximizing contrast. Accepts #RGB/#RRGGBB only. */
export function readableTextOn(color: string): '#020617' | '#ffffff' {
  const hex = color.replace(/^#/, ''); const expanded = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return '#ffffff';
  const c = [0, 2, 4].map(i => parseInt(expanded.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  const luminance = c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
  return (luminance + .05) / .052 > 1.05 / (luminance + .05) ? '#020617' : '#ffffff';
}
export interface PlayerIdentityProps {
  /** Display name (never interpreted as HTML). */ name: string;
  /** Player identity stripe, #RGB or #RRGGBB. */ color: string;
  /** Plain-text emoji player token. */ icon?: string;
  /** Labels reflecting existing player/presence state. */ isYou?: boolean;
  /** Bot label. */ isBot?: boolean;
  /** Disconnected/away label supplied by the caller. */ isAway?: boolean;
  /** Eliminated label. */ isBankrupt?: boolean;
  /** Optional resolved team name. */ teamName?: string;
  /** Layout density; never reduces text below 14px. */ size?: 'sm' | 'md' | 'lg';
  /** Unique seat number or letter marker; defaults to initial. Supply 1–8 to distinguish same-initial players. */ marker?: string | number;
}
export function PlayerIdentity({ name, color, icon, isYou, isBot, isAway, isBankrupt, teamName, size = 'md', marker }: PlayerIdentityProps) {
  const safeColor = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : '#475569';
  return <div className={`mma-ui mma-identity mma-identity-${size}`} style={{ '--mma-player': safeColor } as CSSProperties}>
    <span className="mma-marker" style={{ backgroundColor: safeColor, color: readableTextOn(safeColor) }} aria-hidden="true">{marker ?? name.trim().slice(0, 1).toUpperCase()}</span>
    {icon && <span className="mma-token" aria-hidden="true">{icon}</span>}
    <div className="mma-grow"><strong>{name}</strong><span className="mma-identity-labels">{isYou && 'You · '}{isBot && <><Icon name="bot" size={16} /> Bot · </>}{isAway && 'Away · '}{isBankrupt && 'Bankrupt · '}{teamName ?? ''}</span></div>
  </div>;
}
