@'
# JobTrackr (MVP)

Track job applications automatically from email → dashboard.
- Auto-ingest emails (Gmail/n8n or manual POST)  
- Kanban board: Applied / Interviewing / Rejected / Offer / Other  
- Details panel: emails + status history  
- Drag & drop to change status

## Stack
- React + Vite + Tailwind v4
- Node + Express + Prisma + PostgreSQL (Docker)
- (Optional) n8n for Gmail -> webhook ingestion

## Quick start

### Infra
1. `docker compose -f infra/docker-compose.yml up -d db`

### API
1. `cd apps/api`
2. Copy env: `cp .env.example .env` (Windows: `copy .env.example .env`)
3. Install & start: `npm i && npm run dev`
4. (Optional) Seed: `npm run seed`

### Web
1. `cd ../web`
2. Copy env: `cp .env.example .env`
3. Install & start: `npm i && npm run dev`

Open the printed URL (Vite), set the top-right email if needed, click **Refresh**.

## API
- `GET /applications`
- `GET /applications/:id`
- `PATCH /applications/:id/status` `{ "status": "APPLIED|INTERVIEWING|REJECTED|OFFER|OTHER" }`
- `POST /events/email-ingested` (see `apps/api/scripts/seed.ts` for example payloads)

## Dev notes
- Requires `x-user-email` header on every request (multi-tenant by email).
- Prisma models: User, Application, Email, StatusEvent.
'@ | Out-File -Encoding utf8 README.md
