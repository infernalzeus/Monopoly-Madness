import React from 'react';
import { CurrencyAmount } from './CurrencyAmount';
import { DialogActions, Fact } from './primitives';
import { Icon } from './icons';
export interface RentDialogBodyProps {
  /** Landed property's name. */ propertyName: string;
  /** Creditor name from pendingRent.owner. */ owner: string;
  /** Exact debt; caller calculates rent. */ amount: number;
  /** Current payer cash. */ balance: number;
  /** Owner's pay/declaration transition callback. */ onPay: () => void;
  /** Optional open-portfolio action, not skip rent. */ onManageAssets?: () => void;
  /** Caller-supplied primary block reason. */ disabledReason?: string;
  /** Put actions in the body for standalone use; false when using sticky stage footer. */ actionsInBody?: boolean;
}
export function RentDialogActions({ amount, balance, onPay, onManageAssets, disabledReason }: RentDialogBodyProps) {
  return <DialogActions primary={{ label: balance < amount ? 'Declare bankruptcy' : 'Pay rent', onClick: onPay, disabledReason }} secondary={onManageAssets ? { label: 'Manage assets', onClick: onManageAssets } : undefined} />;
}
export function RentDialogBody(props: RentDialogBodyProps) {
  const { propertyName, owner, amount, balance, actionsInBody = true } = props;
  return <section className="mma-ui mma-dialog-content"><p className="mma-eyebrow"><Icon name="bank" /> Rent due to {owner}</p><h3>{propertyName}</h3><div className="mma-money"><CurrencyAmount amount={-amount} signed /></div><Fact label="Your cash"><CurrencyAmount amount={balance} /></Fact>{balance < amount && <p className="mma-notice mma-tone-loss">Your cash does not cover this debt. Declaring bankruptcy eliminates you; your properties become neutral tiles.</p>}{actionsInBody && <RentDialogActions {...props} />}</section>;
}
