import React from 'react';
import { CurrencyAmount } from './CurrencyAmount';
import { DialogActions, Fact } from './primitives';
import { Icon } from './icons';
export interface PurchaseDialogBodyProps {
  /** Property offered to the current actor. */ propertyName: string;
  /** Actual purchase price computed by caller. */ price: number;
  /** Buyer's current cash. */ balance: number;
  /** Buy transition. */ onBuy: () => void;
  /** Decline/auction decision owned by caller. */ onDecline: () => void;
  /** Honest secondary label (Pass or Start auction); kit does not choose the rule. */ declineLabel?: string;
  /** Rule/actor/write block from caller. */ disabledReason?: string;
  /** Optional mortgage-sale seller name. */ sellerName?: string;
  /** False when actions are in stage footer. */ actionsInBody?: boolean;
}
export function PurchaseDialogActions({ price, balance, onBuy, onDecline, declineLabel = 'Pass', disabledReason }: PurchaseDialogBodyProps) {
  return <DialogActions primary={{ label: 'Buy property', onClick: onBuy, disabledReason: disabledReason || (price > balance ? 'Insufficient cash for this purchase.' : undefined) }} secondary={{ label: declineLabel, onClick: onDecline }} />;
}
export function PurchaseDialogBody(props: PurchaseDialogBodyProps) {
  const { propertyName, price, balance, sellerName, actionsInBody = true } = props;
  return <section className="mma-ui mma-dialog-content"><p className="mma-eyebrow"><Icon name="house" /> {sellerName ? `Purchase from ${sellerName}` : 'Available property'}</p><h3>{propertyName}</h3><div className="mma-money"><CurrencyAmount amount={price} tone="info" /></div><Fact label="Your cash"><CurrencyAmount amount={balance} /></Fact>{actionsInBody && <PurchaseDialogActions {...props} />}</section>;
}
