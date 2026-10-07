// Shared clock used for every game timer (turn clock, auctions, expiry).
// Clients disagree about Date.now() by seconds; offsets are estimated against Firestore's server time
// (see the clock probe in MonopolyGame) so everyone counts down to the same instant.
let offset = 0;
export const serverNow = (): number => Date.now() + offset;
export const setClockOffset = (ms: number): void => {
  if (Number.isFinite(ms) && Math.abs(ms) < 6 * 3600 * 1000) offset = ms;
};
export const getClockOffset = (): number => offset;
