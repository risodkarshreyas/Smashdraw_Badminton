# SmashDraw Badminton

SmashDraw is a public Next.js web application for creating randomized, single-round badminton knockout fixtures. It is designed for Azure App Service and stores its shared rule in Azure Table Storage.

## Features

- Add participants using a multiline list.
- Import names from TXT, CSV, XLS, or XLSX files.
- Generate one randomized knockout round at a time.
- Edit the knockout-round number or name.
- Enter scores, mark each winner, and save completed rounds.
- Toggle a winner off or reset an individual match result.
- Review shared saved results in a separate History tab.
- Re-saving the same round replaces its prior snapshot; saved results can be exported as CSV.
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

Copy `.env.example` to `.env.local` and provide an Azure Storage connection string to use the shared Admin setting locally.

## Build

```bash
npm run build
```

## Tournament configuration

The Admin tab is visible to every user and does not require authentication. The selected top-four protection setting is persisted in the `TournamentSettings` Azure Table and applies to all users. Saved round results are stored separately in the `TournamentHistory` Azure Table and shown in the History tab.

## Azure deployment

The application runs as a standard Next.js Node.js app on Azure App Service. Configure the `AZURE_STORAGE_CONNECTION_STRING` application setting before deployment. Public access is enabled by default because the app does not configure App Service authentication.

## Main project files

- `app/page.tsx` — draw, History, and Admin interfaces.
- `app/api/tournament-config/route.ts` — Azure Table-backed configuration API.
- `app/api/match-history/route.ts` — Azure Table-backed saved-results API.
- `public/og.png` — SmashDraw badminton key art.
- `CONFIGURATION.md` — tournament rule behavior.
