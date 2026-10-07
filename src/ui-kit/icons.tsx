import React, { useId } from 'react';
import { Dice5, House, Hotel, LockKeyhole, KeyRound, Gavel, Handshake, Users, HardHat, Landmark, Banknote, Timer, Trophy, Copy, X, Bot, AlertTriangle, ArrowRight, Check, Plus, Minus, LogOut } from 'lucide-react';
/** Consolidated icons; all output inline SVG. */
const glyphs = { dice: Dice5, house: House, hotel: Hotel, jail: LockKeyhole, key: KeyRound, auction: Gavel, handshake: Handshake, team: Users, worker: HardHat, mortgage: Banknote, bank: Landmark, timer: Timer, trophy: Trophy, copy: Copy, close: X, bot: Bot, warning: AlertTriangle, arrow: ArrowRight, check: Check, plus: Plus, minus: Minus, leave: LogOut };
export type IconName = keyof typeof glyphs;
export interface IconProps {
  /** Glyph from the shared inline-SVG set. */ name: IconName;
  /** Optional accessible image title; omit for icons beside text. */ title?: string;
  /** Pixel size; does not change the control's target area. */ size?: number;
  /** Optional styling hook. */ className?: string;
}
export function Icon({ name, title, size = 20, className }: IconProps) {
  const id = useId(); const Glyph = glyphs[name];
  return <Glyph width={size} height={size} className={className} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} aria-labelledby={title ? id : undefined} focusable="false">{title && <title id={id}>{title}</title>}</Glyph>;
}
