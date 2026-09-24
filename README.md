# DUO Online Multiplayer ❤️

Two-player games playable from separate phones using Supabase Realtime.

## 1. Create Supabase project
Go to https://supabase.com and create a project.

Open SQL Editor and paste everything from `supabase.sql`.

## 2. Get credentials
Supabase Dashboard → Project Settings → API.

Copy:
- Project URL
- anon/public key

## 3. Configure locally
Copy `.env.example` to `.env` and fill:

VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

## 4. Run
```bash
npm install
npm run dev
```

## 5. Deploy
Push the project to GitHub and import it into Netlify/Vercel.

Build command:
`npm run build`

Publish/output directory:
`dist`

Add the same two environment variables in the hosting provider.

## How multiplayer works
1. You enter your name.
2. Create Room.
3. DUO generates a 6-character room code.
4. Send the code to your girlfriend.
5. She enters her name + code and joins.
6. Both phones subscribe to the same Supabase Realtime room.
7. Game state updates on both phones.

## Included online games
- Tic Tac Toe
- Rock Paper Scissors
- Would You Rather
- Who Knows Who?

No passwords or email accounts are required in this MVP.
