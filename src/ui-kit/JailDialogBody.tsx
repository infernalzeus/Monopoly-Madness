import React, { useId } from 'react';
import { CurrencyAmount } from './CurrencyAmount';
import { DialogActions, Fact } from './primitives';
import { Icon } from './icons';
export interface JailDialogBodyProps {
  /** Jail turns left. */ turnsRemaining: number;
  /** Bail amount, already computed by caller. */ fine: number;
  /** Current available cash. */ balance: number;
  /** Number of Get Out of Jail Free cards held. */ jailCards?: number;
  /** Controlled release selection; does not perform release. */ method?: 'pay' | 'card';
  /** Controlled presentation selection callback. */ onMethodChange?: (method: 'pay' | 'card') => void;
  /** Pay fine transition. */ onPay: () => void;
  /** Serve a turn transition. */ onStay: () => void;
  /** Spend held jail card transition. */ onUseCard?: () => void;
  /** Owner-supplied rule/write block. */ disabledReason?: string;
  /** Set false when rendering JailDialogActions in stage footer. */ actionsInBody?: boolean;
}
export function JailDialogActions({ fine, balance, jailCards = 0, method = 'pay', onPay, onStay, onUseCard, disabledReason }: JailDialogBodyProps) {
  const reason = disabledReason || (method === 'card' ? (!jailCards || !onUseCard ? 'You have no available jail card.' : undefined) : fine <= 0 ? 'No rental income to pay bail; stay or use a held card.' : balance < fine ? 'Insufficient cash to pay bail.' : undefined);
  return <DialogActions primary={{ label: method === 'card' ? 'Use jail card & roll' : 'Pay bail & roll', onClick: method === 'card' ? onUseCard ?? (() => {}) : onPay, disabledReason: reason }} secondary={{ label: 'Stay in jail', onClick: onStay }} />;
}
export function JailDialogBody(props: JailDialogBodyProps) {
  const radioName = useId();
  const { turnsRemaining, fine, jailCards = 0, method = 'pay', onMethodChange, actionsInBody = true } = props;
  return <section className="mma-ui mma-dialog-content"><p className="mma-eyebrow"><Icon name="jail" /> {turnsRemaining} turns remaining</p><div className="mma-money"><CurrencyAmount amount={fine} tone="warning" /></div><p>Bail is 20% of rental income. Your turn continues after release.</p><Fact label="Jail cards held">{jailCards}</Fact>{onMethodChange && <fieldset className="mma-fieldset"><legend>How to leave</legend><label className="mma-choice"><input type="radio" name={radioName} checked={method === 'pay'} onChange={() => onMethodChange('pay')} />Pay bail</label><label className="mma-choice"><input type="radio" name={radioName} checked={method === 'card'} onChange={() => onMethodChange('card')} />Use held jail card</label></fieldset>}{actionsInBody && <JailDialogActions {...props} />}</section>;
}
