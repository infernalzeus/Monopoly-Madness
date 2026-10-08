import React, { useId } from 'react';
import { citySkylines } from './citySkylines';
export const groupColors = { brown: '#fdba74', lightBlue: '#7dd3fc', pink: '#f9a8d4', orange: '#fdba74', red: '#fda4af', yellow: '#fde047', green: '#86efac', darkBlue: '#93c5fd', railroad: '#cbd5e1', utility: '#67e8f9' } as const;
export type ArtVariant = keyof typeof groupColors;
export interface CityArtProps {
  /** One reusable skyline silhouette per group/infrastructure type. */ variant: ArtVariant;
  /** Actual city name; selects its individual landmark silhouette when available. */ city?: string;
  /** Optional accessible title; decorative by default. */ title?: string;
}
const roofs: Record<ArtVariant, string> = {
  brown:'M0 90V66H20V48L35 35 50 48V74H65V56H84V31H88V14H92V31H96V56H116V68H140V44L158 26 176 44V70H200V90Z',
  lightBlue:'M0 90V58H18V32H36V70H50V22H65V10H72V22H86V65H104V40H124V15H143V62H160V36H180V68H200V90Z',
  pink:'M0 90V70H25V62H18L40 48H32L51 32 70 48H62L84 62H77V75H100V54H115V37H125V18H132V37H142V54H158V68H180V48H200V90Z',
  orange:'M0 90V74H30V60H46V40H55V24H62V7H66V24H72V40H82V60H96V75H119V48H132V28H144V48H156V72H174V53H200V90Z',
  red:'M0 90V70H26V46H33V30L44 16 55 30V46H62V70H82V50L104 25 126 50V74H147V44H158V27L170 12 182 27V44H193V70H200V90Z',
  yellow:'M0 90V71H28L52 33 61 71H75L98 23 111 71H127L157 40 168 71H200V90Z',
  green:'M0 90V65H20V44H40V71H58V32H75V12H83V32H101V63H123V39H144V60H162V24H181V69H200V90Z',
  darkBlue:'M0 90V68H14V34H32V67H46V47H63V18H85V62H101V39H118V13H137V54H155V26H174V68H200V90Z',
  railroad:'M0 90V77H15V53H42V34H66V53H87V62H157V77H180V67H200V90Z M80 47H180V56H80Z',
  utility:'M0 90V76H28V57H48V25H62V57H82V76H112V62H130V30H145V62H166V76H200V90Z',
};
export function CityArt({ variant, city, title }: CityArtProps) {
  const id=useId();
  return <svg className="mmc-art" viewBox="0 0 200 90" role={title?'img':undefined} aria-hidden={title?undefined:true} aria-labelledby={title?id:undefined} preserveAspectRatio="none">{title&&<title id={id}>{title}</title>}<defs><linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor="#020617"/><stop offset="1" stopColor="#1e293b"/></linearGradient><linearGradient id={`${id}-city`} x2="0" y2="1"><stop stopColor={groupColors[variant]}/><stop offset="1" stopColor={groupColors[variant]} stopOpacity=".48"/></linearGradient></defs><path d="M0 0H200V90H0Z" fill={`url(#${id}-sky)`}/><circle cx="155" cy="26" r="17" fill={groupColors[variant]} opacity=".12"/><path d="M0 77Q45 56 90 72T200 68V90H0Z" fill={groupColors[variant]} opacity=".08"/><path d={city&&citySkylines[city]?citySkylines[city]:roofs[variant]} fill={`url(#${id}-city)`}/><path d="M0 82H200M20 87H174" stroke={groupColors[variant]} opacity=".3"/><path d="M20 66V72M35 55V61M72 41V47M122 52V58M170 47V53" stroke="#020617" strokeWidth="2"/></svg>;
}

