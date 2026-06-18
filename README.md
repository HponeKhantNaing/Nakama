# Maruichi Transport Management System (MTMS)

Production-ready B2B Logistics and Fleet Management System — **Key Coffee 横持輸送** workflow for 20号物流センター.

## Tech Stack

- **Frontend:** Next.js 14 App Router, TypeScript, TailwindCSS, Shadcn UI
- **Backend:** Next.js Route Handlers, Server Actions
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** NextAuth (JWT + Credentials)
- **Real-time:** Server-Sent Events (SSE)

## Quick Start

```bash
npm install
cp .env.example .env
```

### 1. Start PostgreSQL (Docker)

```bash
# First time
docker run --name mtms-postgres -e POSTGRES_USER=mtms_admin -e POSTGRES_PASSWORD=password -e POSTGRES_DB=mtms -p 5433:5432 -d postgres:16

# If container already exists but stopped
docker start mtms-postgres
```

`.env` example:

```
DATABASE_URL="postgresql://mtms_admin:password@localhost:5433/mtms?schema=public"
DIRECT_URL="postgresql://mtms_admin:password@localhost:5433/mtms?schema=public"
NEXTAUTH_SECRET="your-secret-here"
```

### 2. Database setup

```bash
npx prisma db push
npm run db:seed
```

After Yokomochi schema changes:

```bash
npm run db:yokomochi-reset
npm run db:seed
```

### 3. Run dev server

```bash
npm run dev          # network URL for phone/tablet
npm run dev:local    # localhost only
```

Open [http://localhost:3000](http://localhost:3000)

## Demo Accounts

Password for all: **password123**

| Email | Role | Dashboard |
|-------|------|-----------|
| staff@maruichi.jp | 20号物流センター (Warehouse) | `/warehouse` |
| staff@keycoffee.jp | キーコーヒー飲料工場 (Factory) | `/factory/requests` |
| staff@shinwa.jp | 建会社 (Carrier) | `/carrier/requests` |
| staff@kansai-logistics.jp | Subcontractor | `/subcontractor` |
| driver@shinwa.jp | Driver 1 | `/driver/active-job` |
| driver2@shinwa.jp | Driver 2 | `/driver/active-job` |

Internal fleet drivers (no login): **小野**, **浅川** — trucks `WH-10T-A`, `WH-10T-B`

## Key Coffee Yokomochi (横持輸送)

**Theme:** キーコーヒー横持輸送をシステム化

**Process:** 全体像 → 情報整理 → 課題 → 要件定義 → システム設計 → 開発

**Docs:** `docs/keycoffee-yokomochi/`

### 5-Phase Workflow

| Phase | Who | Route | Action |
|-------|-----|-------|--------|
| 1 | Warehouse → Factory | `/warehouse/factory-requests` | Create request |
| 1 | Factory | `/factory/requests` | Respond FULL / PARTIAL / REJECTED |
| 1 | Warehouse | `/warehouse/negotiations` | Approve partial (if needed) |
| 2 | Warehouse | `/warehouse/factory-requests` | **配車便数を計算** (if stuck at APPROVED) |
| 2 | Warehouse | `/warehouse/internal-fleet` | Assign 小野 / 浅川 on timeline |
| 3 | Warehouse | `/warehouse/external-carrier` | Send remaining trips to 建会社 |
| 3 | Carrier | `/carrier/requests` | Respond with available trips |
| 3 | Warehouse | `/warehouse/subcontractors` | View auto subcontract split |
| 3 | Carrier | `/carrier/accepted` | Assign drivers |
| 4 | Driver | `/driver/active-job` | 工場到着 → 積込 → 配送 → 倉庫到着 |
| 5 | Warehouse | `/warehouse/factory-requests` | Approve arrival → COMPLETED |

**Trip rule:** 10t truck = **16 pallets/trip** → `totalTrips = ceil(pallets / 16)`

### Demo flow (recommended)

1. **Warehouse** — create 100-pallet request
2. **Factory** — respond PARTIAL (70 pallets) or FULL
3. **Warehouse** — Negotiations → Approve **or** click **配車便数を計算**
4. **Internal Fleet** — assign trips to internal drivers
5. **External Carrier** — send remainder to 建会社
6. **Carrier** — respond + assign `driver@shinwa.jp`
7. **Driver** — complete trip steps on mobile
8. **Warehouse** — Approve Arrival

## Project Structure

```
app/
  (dashboard)/
    warehouse/          # 20号物流センター (Phase 1–3, 5)
    factory/            # 飲料工場
    carrier/            # 建会社
    driver/             # Mobile driver dashboard
  actions/yokomochi.ts  # Yokomochi server actions
components/yokomochi/   # Accordion, scheduler, carrier panels
docs/keycoffee-yokomochi/
lib/yokomochi/          # Trip calc, carrier allocation
prisma/                 # Schema + seed + reset-yokomochi-tables.sql
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Can't reach database server at localhost:5433` | `docker start mtms-postgres` |
| Login works but actions fail after DB reset | Log out and log back in |
| APPROVED but no trips | Click **配車便数を計算** on Factory Requests |
| Factory FK error on create | Re-login as `staff@maruichi.jp` |

## License

Proprietary — Maruichi Souko Company
