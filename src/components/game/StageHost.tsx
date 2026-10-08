import React, { useState, type ReactNode } from 'react';
import {
  ActionStage, AuctionStatus, CardDialogBody, CardDialogActions, JailDialogBody, JailDialogActions,
  PurchaseDialogBody, PurchaseDialogActions, RentDialogBody, RentDialogActions,
  CurrencyAmount, DialogActions, Fact, KitButton, formatCurrency
} from '@/ui-kit';
import { mortgagePayout } from '@/gameEngine/core';
import { PropertyFace, RevealCard, JailCard } from '@/ui-kit/cards';
import { cardProps, type CardCtx } from './cardAdapters';
import type { GameState, PendingCard, Player, Property } from '@/types/game';

export interface StageHostActions {
  payJailFine: () => void;
  spendJailCard: () => void;
  skipJailTurn: () => void;
  resolveCard: () => void;
  payRent: () => void;
  purchaseProperty: (propertyId: string) => void;
  skipPurchase: () => void;
  placeBid: (amount: number) => void;
  endAuctionNow: () => void;
  buildHouse: (propertyId: string) => void;
  buildHotel: (propertyId: string) => void;
  endTurn: () => void;
  canBuildHouse: (property: Property, ownerName: string) => boolean;
}

interface StageHostProps {
  gameState: GameState;
  me: Player;
  isMyTurn: boolean;
  showJail: boolean;
  jailFine: number;
  pendingCard: PendingCard | null;
  onCardResolving: () => void;
  rent: { propertyName: string; owner: string; amount: number } | null;
  landedOnOwn: Property | null;
  auctionTimer: number | null;
  actions: StageHostActions;
  cardCtx: CardCtx;
  /** Shown when none of the kit situations applies (e.g. the "make an offer on an owned tile" panel). */
  fallback?: ReactNode;
}

/**
 * Chooses the ONE action that owns the board stage (priority: jail → card → rent → own property →
 * auction → purchase) and renders it with the UI kit. Presentation only: every callback is an existing
 * game-hook action, which still validates the actor inside its transaction.
 */
const StageHost: React.FC<StageHostProps> = ({
  gameState, me, isMyTurn, showJail, jailFine, pendingCard, onCardResolving, rent, landedOnOwn, auctionTimer, actions, cardCtx, fallback
}) => {
  const [jailMethod, setJailMethod] = useState<'pay' | 'card'>('pay');
  const auction = gameState.currentAuction;
  const pending = gameState.pendingPurchase;

  let stage: ReactNode = null;

  if (showJail) {
    const cards = me.jailCards || 0;
    const props = {
      turnsRemaining: me.jailTurns, fine: jailFine, balance: me.balance, jailCards: cards,
      method: cards > 0 ? jailMethod : ('pay' as const), onMethodChange: cards > 0 ? setJailMethod : undefined,
      onPay: actions.payJailFine, onStay: actions.skipJailTurn, onUseCard: cards > 0 ? actions.spendJailCard : undefined,
      actionsInBody: false
    };
    stage = (
      <ActionStage kind="jail" title="You're in jail" footer={<JailDialogActions {...props} />}>
        <JailDialogBody {...props} />
        {cards > 0 && <JailCard count={cards} />}
      </ActionStage>
    );
  } else if (pendingCard) {
    const amount = pendingCard.amount;
    const signed = pendingCard.isReward ? amount : -amount;
    const label = pendingCard.type === 'chance' ? 'Chance' : 'Community Chest';
    stage = (
      <ActionStage kind="card" title={label} footer={<p className="mma-muted">Tap the card to reveal it, then collect or pay.</p>}>
        <RevealCard
          key={`${gameState.turn}-${pendingCard.type}-${pendingCard.diceRoll}`}
          kind={pendingCard.type} title={amount === 0 ? 'Nothing happens' : pendingCard.isReward ? 'Lucky draw' : 'Unlucky draw'}
          amount={amount === 0 ? undefined : signed}
          lines={[
            `Roll ${pendingCard.diceRoll} · ${pendingCard.diceRoll % 2 !== 0 ? 'odd → reward' : 'even → penalty'}`,
            `Rental income ${formatCurrency(pendingCard.income)} across ${pendingCard.numProperties} propert${pendingCard.numProperties === 1 ? 'y' : 'ies'}`,
            amount === 0 ? 'No income-producing properties — no change.' : `10% of income = ${formatCurrency(amount)}`
          ]}
          perk={pendingCard.jailCard ? 'Doubles! You earn a Get Out of Jail Free card.' : undefined}
          onContinue={() => { onCardResolving(); actions.resolveCard(); }}
          continueLabel={amount === 0 ? 'Continue' : pendingCard.isReward ? `Collect ${formatCurrency(amount)}` : `Pay ${formatCurrency(amount)}`}
        />
      </ActionStage>
    );
  } else if (rent) {
    const props = { propertyName: rent.propertyName, owner: rent.owner, amount: rent.amount, balance: me.balance, onPay: actions.payRent, actionsInBody: false };
    stage = (
      <ActionStage kind="rent" title="Rent due" footer={<RentDialogActions {...props} />}>
        <RentDialogBody {...props} />
      </ActionStage>
    );
  } else if (landedOnOwn) {
    const p = landedOnOwn;
    const canHouse = p.type === 'property' && !p.hasHotel && p.houses < 4 && actions.canBuildHouse(p, me.name);
    const canHotel = p.type === 'property' && !p.hasHotel && p.houses >= 4;
    const nextCost = canHotel ? p.hotelCost || 0 : (p.houseCost || 0) * (p.houses + 1);
    const build = canHouse || canHotel;
    stage = (
      <ActionStage
        kind="own-property" title="Your property" subtitle={p.name}
        footer={
          <DialogActions
            primary={build
              ? { label: canHotel ? 'Build hotel & end turn' : 'Build house & end turn', onClick: () => { (canHotel ? actions.buildHotel : actions.buildHouse)(p.id); actions.endTurn(); }, disabledReason: me.balance < nextCost ? 'Insufficient cash to build.' : undefined }
              : { label: 'End turn', onClick: actions.endTurn }}
            secondary={build ? { label: 'End turn', onClick: actions.endTurn } : undefined}
          />
        }
      >
        <div className="flex flex-col items-center gap-2">
          <div className="sm:[zoom:1.2]"><PropertyFace {...cardProps(cardCtx, p, 'hand')} /></div>
          <details className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold text-slate-200 min-h-[32px] flex items-center">Full title deed &amp; rent table</summary>
            <div className="mt-2 flex justify-center"><PropertyFace {...cardProps(cardCtx, p, 'full')} /></div>
          </details>
        </div>
        {p.type === 'property' ? (
          <>
            <Fact label="Buildings">{p.hasHotel ? 'Hotel' : `${p.houses} / 4 houses`}</Fact>
            {!p.hasHotel && <Fact label={canHotel ? 'Hotel cost' : 'Next house cost'}><CurrencyAmount amount={nextCost} /></Fact>}
            {!build && !p.hasHotel && <p className="mma-muted">You need the whole colour group (and an even build) before you can build here.</p>}
          </>
        ) : <p className="mma-muted">Nothing to build on this tile.</p>}
      </ActionStage>
    );
  } else if (auction) {
    const property = gameState.properties.find(p => p.id === auction.propertyId);
    const isSeller = auction.startedBy === me.name;
    const min = auction.currentBid + 10000;
    const secondsLeft = auctionTimer ?? Math.max(0, Math.ceil((auction.endTimestamp - Date.now()) / 1000));
    const blocked = me.isSpectator ? 'Spectators watch only.' : !me.isActive ? 'You are out of the game.' : undefined;
    stage = (
      <ActionStage
        kind="auction" title={gameState.preAuctionPhase ? 'Draft auction' : 'Auction'}
        footer={
          isSeller ? (
            <KitButton variant="primary" onClick={actions.endAuctionNow}>
              {auction.highestBidder ? `Collect ${formatCurrency(auction.currentBid)} from ${auction.highestBidder}` : 'End auction (no bids — turn passes)'}
            </KitButton>
          ) : <p className="mma-muted">A late bid extends the clock to at least 15 seconds.</p>
        }
      >
        {property && <div className="flex flex-col items-center gap-2">
          <div className="sm:[zoom:1.2]"><PropertyFace {...cardProps(cardCtx, property, 'hand')} /></div>
          <details className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold text-slate-200 min-h-[32px] flex items-center">Full title deed &amp; rent table</summary>
            <div className="mt-2 flex justify-center"><PropertyFace {...cardProps(cardCtx, property, 'full')} /></div>
          </details>
        </div>}
        <AuctionStatus
          propertyName={property?.name ?? 'Property'} currentBid={auction.currentBid} highestBidder={auction.highestBidder}
          you={me.name} secondsLeft={secondsLeft} totalSeconds={Math.max(auction.duration, secondsLeft)}
          minIncrement={10000} quickBids={[min, min + 25000, min + 50000]} onBid={actions.placeBid}
          balance={me.balance} isSeller={isSeller} isDraft={gameState.preAuctionPhase}
          hasBid={auction.bids.some(b => b.player === me.name)} disabledReason={blocked}
        />
      </ActionStage>
    );
  } else if (pending && isMyTurn) {
    const property = gameState.properties.find(p => p.id === pending.propertyId);
    if (property) {
      const mortgagedBuy = property.isOwned && property.isMortgaged;
      const props = {
        propertyName: property.name, price: mortgagedBuy ? mortgagePayout(property) : property.currentValue, balance: me.balance,
        onBuy: () => actions.purchaseProperty(property.id), onDecline: actions.skipPurchase,
        declineLabel: gameState.settings.auctionsEnabled && !mortgagedBuy ? 'Pass — send to auction' : 'Pass',
        sellerName: mortgagedBuy ? property.owner : undefined, actionsInBody: false
      };
      stage = (
        <ActionStage kind="purchase" title="Property for sale" footer={<PurchaseDialogActions {...props} />}>
          <div className="flex flex-col items-center gap-2">
          <div className="sm:[zoom:1.2]"><PropertyFace {...cardProps(cardCtx, property, 'hand')} /></div>
          <details className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold text-slate-200 min-h-[32px] flex items-center">Full title deed &amp; rent table</summary>
            <div className="mt-2 flex justify-center"><PropertyFace {...cardProps(cardCtx, property, 'full')} /></div>
          </details>
        </div>
          <PurchaseDialogBody {...props} />
        </ActionStage>
      );
    }
  }

  if (!stage) return <>{fallback ?? null}</>;
  // Desktop: a scrollable layer over the board centre. Phone: the kit renders its own fixed bottom sheet (`contents` removes this layer).
  return <div className="absolute inset-0 z-50 overflow-y-auto bg-slate-950/95 max-sm:contents">{stage}</div>;
};

export default StageHost;
