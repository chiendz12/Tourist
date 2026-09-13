# VietJourney — Tourist Map

Monorepo with two deployable apps:

- `frontend/` — Next.js 16 tourist map app (port 3001). Deploy with root directory `frontend/`.
- `backend/` — NestJS 10 + Prisma + PostGIS API (port 3000). Deploy with root directory `backend/`.
- `docker-compose.yml` — local Postgres (PostGIS) + API for development and e2e.

## Getting started

```bash
# install both apps
npm --prefix frontend install
npm --prefix backend install

# backend env (DATABASE_URL, JWT_*, MAPBOX_*, SMTP_*)
cp backend/.env.example backend/.env

# frontend env (API URL, Mapbox public token)
cp frontend/.env.local.example frontend/.env.local

# database + api
docker compose up -d
npm --prefix backend run prisma:deploy
npm --prefix backend run db:seed
```

Run each app (two terminals):

```bash
npm run dev            # frontend → http://localhost:3001
npm run backend:start:dev  # api → http://localhost:3000/api
```

Or via the root shortcuts (`npm run build`, `npm run backend:build`,
`npm run backend:test`, `npm run test:e2e:api`, `npm run docker:build`).
