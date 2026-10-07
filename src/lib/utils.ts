import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Explicit signed money: "+$750,000" / "−$750,000" (a real minus sign, so a loss never reads as a gain)
export function formatSignedMoney(amount: number): string {
  const abs = Math.abs(Math.round(amount)).toLocaleString('en-US')
  return `${amount < 0 ? '\u2212' : '+'}$${abs}`
}

// Pick dark or light text for a player-colour fill so badges stay >= 4.5:1 (white on cyan/amber fails)
export function readableTextOn(hex?: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return L > 0.3 ? '#0b1220' : '#ffffff'
}
