# SmashDraw Badminton

SmashDraw is a responsive web application for creating randomized, single-round badminton knockout fixtures.

## Features

- Add participants using a multiline list.
- Import names from TXT, CSV, XLS, or XLSX files.
- Generate one randomized knockout round at a time.
- Automatically assign byes when required.
- Optionally prevent participants 1–4 from drawing one another.
- Shared tournament rule controls available without authentication.
- Print-friendly match fixtures.

## Run locally

Prerequisite: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

## Tournament configuration

The Admin tab is visible to every user and does not require authentication. The selected top-four protection setting is persisted in a D1 database and applies to all users. Database schema and migrations are in `db/` and `drizzle/`.

## Main project files

- `app/page.tsx` — tournament and Admin interfaces.
- `app/api/tournament-config/route.ts` — shared configuration API.
- `public/og.png` — SmashDraw badminton key art.
- `CONFIGURATION.md` — tournament rule behavior.
