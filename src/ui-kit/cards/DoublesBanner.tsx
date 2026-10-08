import React from 'react';
import { Icon } from '../icons';
export interface DoublesBannerProps {
  /** Triple doubles sends the actor to jail. */ triple?: boolean;
  /** Controlled visibility; owner may unmount after 1500ms. No kit timer. */ visible?: boolean;
  /** Notify after the 1.5s presentation animation ends; owner controls unmount. */ onFinished?: () => void;
}
export function DoublesBanner({triple=false,visible=true,onFinished}:DoublesBannerProps){return visible?<div className={`mma-ui mmc-doubles ${triple?'mmc-triple':''}`} role="status" onAnimationEnd={onFinished}><Icon name={triple?'jail':'dice'}/><strong>{triple?'TRIPLE DOUBLES — GO TO JAIL':'DOUBLES — roll again'}</strong></div>:null;}
