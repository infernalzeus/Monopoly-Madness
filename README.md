# Monopoly Madness App

Welcome to the Monopoly Madness mod app! This project features a completely reimagined digital Monopoly experience with modern design, multiplayer support, and specialized game modes like Auction, Team, and Trade.

## Features
- **Multiplayer Lobbies** with Firebase backend
- **Dynamic Board UI** tailored for a great player experience
- **Game Modes**: Trading, Pre-Auction, and Custom modifications to the classic Monopoly game rules
- **Dark Mode** integrated directly into the gameplay engine

## Tech Stack
- React
- TypeScript
- Vite
- Firebase
- Tailwind CSS
- shadcn/ui

## Getting Started

To run the application locally:

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```

Enjoy your game!

## Firebase setup
1. Copy `.env.example` to `.env.local` and fill in your web-app values (Firebase Console → Project settings → Your apps).
2. Console → Authentication → Sign-in method → enable **Anonymous** (each browser gets a stable uid that its seat is bound to).
3. Deploy `firestore.rules` (Console → Firestore → Rules, or `firebase deploy --only firestore:rules`).
4. Optional hardening: Google Cloud Console → APIs & Services → Credentials → restrict the browser key to your site's referrers.
Web API keys are not secrets; the rules and the referrer restriction are what protect the project.
