/** All 22 cities + four railroads + two utilities on today's 40-position board.
 * Six additional city lines satisfy the expanded 28-city brief without adding game tiles. */
export const flavour: Readonly<Record<string, string>> = {
  London: 'The queue is orderly. The rent is not.', Paris: 'Even the balconies have a flair for negotiation.',
  'New York': 'A city that never sleeps on a good deal.', Chicago: 'Big shoulders. Bigger property ambitions.',
  'Los Angeles': 'Your next blockbuster might be a rent receipt.', Tokyo: 'Every light has a story. Every square has a price.',
  Seoul: 'Tomorrow called. It wants this address.', Osaka: 'Come for the flavour; stay for the portfolio.',
  Dubai: 'The skyline keeps raising the stakes.', 'Abu Dhabi': 'An oasis for a very thirsty balance sheet.',
  Doha: 'A small pin on the map, a bold entry in the ledger.', Moscow: 'Bundle up. The bidding gets chilly.',
  Berlin: 'Reinvent the block. Keep the deed.', Rome: 'Built over centuries. Acquired in one turn.',
  Sydney: 'Harbour views, horizon-sized plans.', Melbourne: 'A good address pairs well with another coffee.',
  Brisbane: 'Sunshine is complimentary. This corner is not.', 'São Paulo': 'The city moves fast; hold on to your deed.',
  'Buenos Aires': 'Every negotiation deserves a little rhythm.', 'Mexico City': 'Layers of history, room for one more house.',
  Singapore: 'Small island. Remarkably large possibilities.', 'Hong Kong': 'The view climbs as high as your ambitions.',
  'Orient Express': 'All aboard the long game.', 'Trans-Siberian Rail': 'Distance makes the portfolio grow fonder.',
  'Pan-Pacific Express': 'Ocean-sized journeys, pocket-sized tickets.', 'Trans-Atlantic Rail': 'Connecting continents and collecting fares.',
  'Power Grid': 'A bright idea with recurring revenue.', Waterworks: 'Go with the flow. Send the invoice.',
  Delhi: 'Old lanes, new deals, endless possibilities.', Mumbai: 'The city keeps moving; your deed can stay put.',
  Shanghai: 'A skyline with room for another ambition.', Madrid: 'Late evenings, timely investments.',
  Toronto: 'A warm welcome, even on a cold market day.', 'Cape Town': 'Table views with room for a full house.',
};
export const flavourFor = (name: string): string => flavour[name] ?? 'A new address for your next great plan.';
