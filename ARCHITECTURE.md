# Tourist Map Backend — Architecture

**Stack:** NestJS 10 · Prisma · PostgreSQL + PostGIS · Mapbox · JWT/Passport · Swagger · Docker

---

## 1. High-level layers

```
┌──────────────────────────────────────────────────────────────┐
│  Clients (Web / Mobile / Admin)                              │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS / JWT
┌──────────────────────────────▼───────────────────────────────┐
│  NestJS API Gateway (REST + Swagger)                         │
│  ── Guards: JwtAuth · Roles · Province · HocPhan             │
│  ── Interceptors: Logging · Transform · Timeout              │
│  ── Pipes: ValidationPipe (class-validator)                  │
└──────┬─────────────┬──────────────┬───────────────┬──────────┘
       │             │              │               │
   Auth/Users   Public Domain   Training Domain   Map Services
                (destinations,  (hocphan, class,  (Mapbox SDK,
                 tours, ratings) approval engine)  PostGIS qry)
       │             │              │               │
       └─────────────┴──────┬───────┴───────────────┘
                            ▼
              Prisma ORM ──► PostgreSQL + PostGIS
                            ▼
                      Redis (cache, queues — optional)
                            ▼
                Mapbox API (geocoding · directions · static)
```

## 2. Folder structure

The repo is split into two deployable apps sharing one `docker-compose.yml`:

```
frontend/                       # Next.js 16 app (deploy: Vercel, root dir = frontend/)
├─ src/app/                     # routes: public, member, studio, BFF proxy, session
├─ src/components/              # ui, layout, destination, map, itinerary
├─ src/lib/                     # env, api client/services, auth, query keys
├─ public/  next.config.ts  postcss.config.mjs  eslint.config.mjs
└─ .env.local                   # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_MAPBOX_TOKEN

backend/                        # NestJS 10 API (deploy: Render, root dir = backend/)
├─ src/
│  ├─ main.ts
│  ├─ app.module.ts
├─ config/                       # env schema, app config
│   ├─ configuration.ts
│   └─ env.validation.ts
├─ common/                       # shared across modules
│   ├─ decorators/               # @Roles, @CurrentUser, @ProvinceScope, @HocPhan
│   ├─ guards/                   # JwtAuthGuard, RolesGuard, ProvinceGuard, HocPhanGuard
│   ├─ interceptors/             # LoggingInterceptor, TransformInterceptor
│   ├─ filters/                  # AllExceptionsFilter
│   ├─ pipes/                    # ParseGeoJsonPipe
│   ├─ dto/                      # PaginationDto, GeoQueryDto
│   └─ utils/                    # geo helpers, hash, etc.
├─ prisma/
│   ├─ prisma.module.ts
│   └─ prisma.service.ts
├─ modules/
│   ├─ auth/                     # login, refresh, register, JWT strategy
│   ├─ users/                    # CRUD users, profile
│   ├─ roles/                    # ROLE seed: GUEST, MEMBER, STUDENT, LEADER, LECTURER, SUPER_ADMIN
│   ├─ provinces/                # 63 tỉnh/thành (seed)
│   ├─ hocphan/                  # 3 học phần (seed)
│   ├─ classes/                  # lớp học, nhóm, phân tỉnh
│   ├─ destinations/             # điểm đến (PostGIS POINT)
│   ├─ routes/                   # tuyến du lịch (LINESTRING / waypoints)
│   ├─ tours/                    # tour: ngày, lịch trình, tính giá
│   ├─ suppliers/                # nhà cung cấp (KS, NH, vận chuyển)
│   ├─ ratings/                  # đánh giá & comment
│   ├─ itinerary/                # generate + export PDF
│   ├─ approval/                 # 4-cấp engine + history
│   ├─ notifications/            # email + in-app
│   ├─ mapbox/                   # geocoding, directions, static
│   └─ reports/                  # dashboard, audit log
└─ jobs/                         # cron / queue handlers (optional)

│  prisma/
│  ├─ prisma.module.ts
│  └─ prisma.service.ts
│
├─ prisma/                      # schema, migrations, seed
├─ test/                        # e2e runner + suite
├─ scripts/                     # ops helpers (image fetcher)
├─ nest-cli.json  Dockerfile  .dockerignore  .eslintrc.js
└─ .env                         # DATABASE_URL, JWT_*, MAPBOX_*, SMTP_*
```

## 3. Authentication & Authorization

- **JWT access (15 min) + refresh (7 days)** stored hashed in DB.
- **Passport strategies:** `local`, `jwt`, `jwt-refresh`.
- **Guards composition:**
  - `@UseGuards(JwtAuthGuard, RolesGuard, ProvinceGuard, HocPhanGuard)`
  - Each guard reads metadata via `Reflector`:
    - `@Roles('LECTURER','SUPER_ADMIN')`
    - `@ProvinceScope('param:provinceId')` — verifies user is assigned that province.
    - `@HocPhan('HP1' | 'HP2' | 'HP3')` — verifies user enrollment.

### Role matrix (summary)

| Role        | Public | HP1 Destination | HP2 Route/Tour | HP3 Supplier/Pricing | Approval | Admin |
|-------------|:------:|:---------------:|:--------------:|:--------------------:|:--------:|:-----:|
| GUEST       | R      | —               | —              | —                    | —        | —     |
| MEMBER      | R + rate/comment | —     | —              | —                    | —        | —     |
| STUDENT     | R      | C/U own         | C/U own        | C/U own              | submit   | —     |
| LEADER      | R      | review (group)  | review         | review               | L1       | —     |
| LECTURER    | R      | review (class)  | review         | review               | L2       | class mgmt |
| SUPER_ADMIN | R      | full            | full           | full                 | L3 final | full  |

## 4. Approval workflow (4 cấp)

```
DRAFT ──submit──► PENDING_LEADER ──approve──► PENDING_LECTURER
                       │                            │
                       └─reject─► REJECTED          └─approve─► PENDING_ADMIN
                                                                   │
                                                          approve ─┴─► PUBLISHED
                                                          reject ────► REJECTED
```

- Single polymorphic `Approval` table: `entityType` (DESTINATION|ROUTE|TOUR), `entityId`, `currentLevel`, `status`.
- `ApprovalHistory` rows for every transition (who, when, comment).
- Notification fires on every state change (in-app + email).

## 5. Spatial data (PostGIS)

- `geometry(Point, 4326)` for destinations.
- `geometry(LineString, 4326)` for route paths (computed from Mapbox Directions or user-drawn).
- Indexes: `GIST` on geometry columns.
- Common queries:
  - Nearby destinations: `ST_DWithin(location, ST_MakePoint(:lng,:lat)::geography, :radius)`
  - Bbox: `location && ST_MakeEnvelope(...)`
  - Route length: `ST_Length(path::geography)`

## 6. Mapbox integration

Wrapper service `MapboxService` exposes:
- `geocode(address)` → `[lng,lat]`
- `reverseGeocode(lng,lat)`
- `directions(coords[], profile)` → GeoJSON + duration/distance
- `staticMap(coords[], size)` → image URL
- Token stored server-side; client requests proxied through `/api/map/*` to avoid leaking key.

## 7. API surface (high-level)

```
/auth         POST /login /register /refresh /logout
/users        CRUD + /me
/provinces    GET (public), POST (admin)
/hocphan      GET, POST (admin)
/classes      CRUD (lecturer scope)
/destinations CRUD + /nearby + /bbox  (HP1)
/routes       CRUD + /optimize        (HP2)
/tours        CRUD + /pricing         (HP2/3)
/suppliers    CRUD                    (HP3)
/ratings      POST/GET (member+)
/itinerary    POST /generate /export
/approvals    POST /submit  POST /:id/approve|reject  GET /pending
/notifications GET, PATCH /:id/read
/map          /geocode /reverse /directions /static
/reports      /dashboard /audit
```

## 8. Non-functional

- **Validation:** global `ValidationPipe({ whitelist:true, transform:true })`.
- **Rate limit:** `@nestjs/throttler` (default 60 req/min, stricter on `/auth`).
- **Logging:** Winston (JSON in prod) + request id correlation.
- **Errors:** unified `AllExceptionsFilter` → `{ statusCode, message, errorCode, traceId }`.
- **Docs:** Swagger at `/docs`.
- **Tests:** Jest unit + Supertest e2e + isolated Prisma test DB.
- **Deploy:** Docker (api + postgis + redis), PM2/Railway/Render.

## 9. Environment variables

See `.env.example`. Critical: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MAPBOX_TOKEN`, `SMTP_*`.
