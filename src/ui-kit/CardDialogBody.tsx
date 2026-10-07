import React from 'react';
import { CurrencyAmount } from './CurrencyAmount';
import { DialogActions, Fact } from './primitives';
import { Icon } from './icons';
export interface CardDialogBodyProps {
  /** Card heading. */ type: 'chance' | 'community';
  /** Positive magnitude from PendingCard.amount. */ amount: number;
  /** Reward flag supplied by engine. */ isReward: boolean;
  /** Dice total that caused this card. */ diceRoll: number;
  /** Caller-computed rental income. */ income: number;
  /** Number of income-producing properties. */ numProperties: number;
  /** Doubles also award a jail card. */ jailCard?: boolean;
  /** Resolve once through the game adapter. */ onResolve: () => void;
  /** Optional view-calculation callback. */ onDetails?: () => void;
  /** Owner-supplied pending/error block. */ disabledReason?: string;
  /** False when actions are placed in stage footer. */ actionsInBody?: boolean;
}
export function CardDialogActions({ amount, isReward, onResolve, onDetails, disabledReason }: CardDialogBodyProps) {
  return <DialogActions primary={{ label: amount === 0 ? 'Continue' : isReward ? 'Collect reward' : 'Pay penalty', onClick: onResolve, disabledReason }} secondary={onDetails ? { label: 'View calculation', onClick: onDetails } : undefined} />;
}
export function CardDialogBody(props: CardDialogBodyProps) {
  const { amount, isReward, diceRoll, income, numProperties, jailCard, actionsInBody = true } = props;
  return <section className="mma-ui mma-dialog-content"><p className="mma-eyebrow"><Icon name="dice" /> Roll {diceRoll} · {isReward ? 'Reward' : 'Penalty'}</p><div className="mma-money"><CurrencyAmount amount={isReward ? amount : -amount} signed /></div><Fact label="Rental income"><CurrencyAmount amount={income} /></Fact><Fact label="Income properties">{numProperties}</Fact>{amount === 0 && <p>No income-based reward or penalty this time.</p>}{jailCard && <p className="mma-notice mma-tone-gain"><Icon name="key" /> You also receive a Get Out of Jail Free card.</p>}{actionsInBody && <CardDialogActions {...props} />}</section>;
}
