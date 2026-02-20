# Convex Leaderboard Scaffold

This folder contains a starter backend for leaderboard auth + totals using Convex Auth.

## Included

- `auth.config.ts`: Convex auth provider config.
- `auth.ts`: Convex Auth setup with GitHub OAuth provider.
- `http.ts`: Registers auth HTTP routes.
- `schema.ts`: `users` and `leaderboardTotals` tables.
- `leaderboard.ts`: starter mutations/queries for:
  - `totalTokens`
  - `totalCompletedTasks`

## Required env vars

Set these in Convex:

- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`

## Typical setup

1. Initialize/login to Convex and connect a project.
2. Generate Convex types:
   - `npx convex codegen`
3. Deploy/push functions:
   - `npx convex dev`

In the Electron renderer, set:

- `VITE_CONVEX_URL=<your convex deployment url>`

Then use the leaderboard page sign-in button in dev mode to test auth flow.

## Notes

- This is a starter scaffold, not anti-cheat hardened yet.
- Current leaderboard UI still uses mock list values until wired to Convex queries.
