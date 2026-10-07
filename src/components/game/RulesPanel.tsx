import React from 'react';
import { GameSettings } from '@/types/game';

interface RulesPanelProps {
  settings: GameSettings;
  onClose: () => void;
}

const Section: React.FC<{ title: string; emoji: string; children: React.ReactNode }> = ({ title, emoji, children }) => (
  <div className="space-y-2">
    <h3 className="text-base font-bold text-cyan-300 flex items-center gap-2 border-b border-slate-700 pb-1">
      <span>{emoji}</span> {title}
    </h3>
    <div className="text-sm text-slate-300 space-y-1">{children}</div>
  </div>
);

const Rule: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="flex gap-2"><span className="text-cyan-500 flex-shrink-0">•</span><span>{children}</span></p>
);

const RulesPanel: React.FC<RulesPanelProps> = ({ settings, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-cyan-500/60 rounded-2xl shadow-2xl my-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-700">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <span>📖</span> Game Rules
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-700 transition-colors"
          >✕</button>
        </div>

        <div className="px-6 py-5 space-y-6 max-h-[80vh] overflow-y-auto">

          <Section title="Basic Movement" emoji="🎲">
            <Rule>Roll two dice on your turn and move that many spaces around the board.</Rule>
            <Rule>The board has 40 spaces — when you pass or land on GO, collect <strong className="text-yellow-300">10% of your current cash</strong> (minimum ${settings.passGoReward.toLocaleString('en-US')}).</Rule>
            <Rule>If you roll doubles, you may roll again after your turn resolves. Three consecutive doubles sends you to Jail.</Rule>
            <Rule>Landing on Chance or Community Chest <strong className="text-yellow-300">on a double</strong> also earns a Get Out of Jail Free card (use it from the Jail dialog).</Rule>
          </Section>

          <Section title="Buying Properties" emoji="🏘️">
            <Rule>Landing on an unowned property lets you buy it at its listed price.</Rule>
            <Rule>If you decline to buy, {settings.auctionsEnabled ? 'an auction opens for all players to bid on the property.' : 'the property remains unowned.'}</Rule>
            <Rule>Owning all properties in a colour group gives a <strong className="text-yellow-300">2× base rent</strong> monopoly bonus (no houses needed).</Rule>
          </Section>

          <Section title="Rent" emoji="💸">
            <Rule>Landing on another player's property means you owe them rent based on its development level.</Rule>
            <Rule><strong className="text-rose-300">Jailed owners cannot collect rent</strong> — landing on their property is free while they're imprisoned.</Rule>
            <Rule>Railroads scale from $25K (1 owned) → $50K → $1L → $2L (all 4 owned).</Rule>
            <Rule>Utilities charge 4× dice total (1 utility) or 10× dice total (both utilities).</Rule>
          </Section>

          <Section title="Building Houses & Hotels" emoji="🏗️">
            <Rule>Once you own a full colour group, you can build houses (up to 4) then a hotel for much higher rent.</Rule>
            <Rule>You must build evenly across your group — no property can have more than 1 house ahead of others.</Rule>
            <Rule>Hotels replace 4 houses and represent the maximum rent tier.</Rule>
          </Section>

          <Section title="🔒 Jail" emoji="🔒">
            <Rule>You're sent to Jail by landing on "Go to Jail", or drawing a jail card.</Rule>
            <Rule>While in Jail, you <strong className="text-rose-300">cannot collect rent</strong> and cannot buy or receive property.</Rule>
            <Rule>To leave: pay <strong className="text-yellow-300">20% of your total property income</strong> as bail, or wait up to 3 turns (turn counter auto-decrements each turn you stay).</Rule>
            <Rule>"Just Visiting" (position 10) is safe — only players with <em>isInJail</em> status are affected.</Rule>
          </Section>

          <Section title="Chance & Community Chest" emoji="🎲">
            <Rule>Landing on these spaces triggers an <strong className="text-yellow-300">income-based roll outcome</strong>:</Rule>
            <Rule><strong className="text-green-300">Odd dice roll</strong> = <strong>Reward</strong> — you collect 10% of your total property income.</Rule>
            <Rule><strong className="text-rose-300">Even dice roll</strong> = <strong>Penalty</strong> — you pay 10% of your total property income.</Rule>
            <Rule>Property income is the sum of current rent tiers for all your owned (non-mortgaged) properties.</Rule>
            <Rule>If you own no properties, nothing happens.</Rule>
          </Section>

          <Section title="Taxes" emoji="🏛️">
            <Rule><strong>Income Tax (pos 4)</strong>: Pay 10% of your total wealth (cash + property values).</Rule>
            <Rule><strong>Luxury Tax (pos 38)</strong>: Pay 10% of your total wealth.</Rule>
          </Section>

          <Section title="Mortgaging" emoji="🏦">
            <Rule>Mortgage a property to receive 50% of its value instantly. You can no longer collect rent on mortgaged properties.</Rule>
            <Rule>Un-mortgage at 55% of the property's value (10% interest on top of the 50% you received).</Rule>
          </Section>

          {settings.auctionsEnabled && (
            <Section title="Auction Mode" emoji="🔨">
              <Rule>When you land on an unowned property you can launch an auction instead of buying it yourself.</Rule>
              <Rule>Minimum starting bid is 70% of market value. You (the seller) receive the winning bid.</Rule>
              <Rule>Bids extend the timer to at least 15 seconds. If no one bids, the property stays unowned.</Rule>
            </Section>
          )}

          {settings.teamsEnabled && (
            <Section title="Teams" emoji="👥">
              <Rule>Players can form teams and view combined wealth in the Team Panel.</Rule>
              <Rule>Both players in a team keep their own balance, properties, and turns — no merging.</Rule>
              <Rule>Colour group monopolies count across teammates (2× rent), and <strong className="text-yellow-300">teammates never pay each other rent</strong>.</Rule>
              <Rule>Once any player is eliminated, the game ends as soon as everyone left is on the same team.</Rule>
            </Section>
          )}

          {settings.workersEnabled && (
            <Section title="Workers Mode" emoji="👷">
              <Rule>Assign workers to your owned properties via the 👷 Workers button.</Rule>
              <Rule>Each worker automatically builds <strong className="text-yellow-300">one house per GO pass</strong> on their assigned property.</Rule>
              <Rule>You must own a full colour group before houses can be built (even by workers).</Rule>
              <Rule>After reaching 4 houses, the worker upgrades to a hotel on the next GO.</Rule>
              <Rule>Workers are shown as small faces beside their property name in your player panel.</Rule>
            </Section>
          )}

          {settings.tradingEnabled && (
            <Section title="Trading" emoji="🤝">
              <Rule>Open the Trading Market at any time during your turn to offer property swaps or cash deals.</Rule>
              <Rule>The receiving player can accept or reject in real-time.</Rule>
            </Section>
          )}

          {settings.blindPickEnabled && (
            <Section title="Blind Pick" emoji="👁️">
              <Rule>All board properties start hidden (shown as ???).</Rule>
              <Rule>A property is revealed only when a player lands on it for the first time.</Rule>
            </Section>
          )}

          <Section title="Bankruptcy & Winning" emoji="🏆">
            <Rule>If a payment can't be covered, you're bankrupt. Forced payments (tax, cards, a timed-out rent) first sell buildings and mortgage properties automatically; you can also mortgage/sell yourself, or declare bankruptcy.</Rule>
            <Rule>A bankrupt player's properties become <strong className="text-slate-300">neutral tiles</strong> — no rent, no purchase. Rent still pending to a player who just went out is waived. You can keep watching as a spectator.</Rule>
            <Rule>The last active player standing wins the game!</Rule>
          </Section>

          <p className="text-xs text-slate-500 text-center pt-2 border-t border-slate-700">
            Click anywhere outside this panel to close · Monopoly Madness v1.1.9
          </p>
        </div>
      </div>
    </div>
  );
};

export default RulesPanel;
