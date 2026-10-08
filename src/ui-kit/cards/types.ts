import type { Property } from '../../types/game';
import type { PlayerIdentityProps } from '../PlayerIdentity';
export interface CardAction {
  /** Stable action key, supplied by adapter. */ id: 'build-house' | 'build-hotel' | 'sell' | 'mortgage' | 'unmortgage';
  /** Include the actual price in the adapter's label. */ label: string;
  /** Executes an authorized game action outside the kit. */ onAction: () => void;
  /** Visible reason when this action is unavailable. */ disabledReason?: string;
}
export interface PropertyCardProps {
  /** Existing property record; never mutated. */ property: Property;
  /** Size of the face. Full is a noninteractive title deed. */ size?: 'mini' | 'hand' | 'full';
  /** Actual payable rent, or a dice-based label, computed outside the kit. */ rentNow: number | string;
  /** Resolve owner and team from existing players/teams. */ owner?: PlayerIdentityProps;
  /** Existing monopoly calculation output. */ hasMonopoly?: boolean;
  /** Existing team rent/monopoly eligibility output. */ teamBoosted?: boolean;
  /** Blind-pick presentation mask; must also mask accessible text. */ hidden?: boolean;
  /** Current mortgage payout calculated by the adapter, not legacy mortgageValue. */ mortgageAmount: number;
  /** Authorized actions shown in the inspect footer. */ actions?: CardAction[];
  /** Controlled selected indicator (trade picker). */ selected?: boolean;
  /** Overrides opening inspect, e.g. toggles trade selection. */ onSelect?: () => void;
  /** Blocks selection with visible text, e.g. a built-group lock. */ selectionDisabledReason?: string;
  /** Initial inspect state for development/controlled mount previews. */ initiallyInspecting?: boolean;
  /** Optional drag-free ordering transitions; omit at boundaries. */ onMoveLeft?: () => void;
  /** Move right in the caller's presentation order. */ onMoveRight?: () => void;
  /** Report inspection changes; not a game transition. */ onInspectChange?: (open: boolean) => void;
}
