# Maruichi Transport Management System (MTMS)

Production-ready B2B Logistics and Fleet Management System — **Key Coffee 横持輸送** workflow for 20号物流センター.

## Tech Stack

- **Frontend:** Next.js 14 App Router, TypeScript, TailwindCSS, Shadcn UI
- **Backend:** Next.js Route Handlers, Server Actions
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** NextAuth (JWT + Credentials)
- **Real-time:** Server-Sent Events (SSE)

---

## First-time setup (after `git clone`)

Run these commands from the project root:

```bash
# 1. Install dependencies
npm install

# 2. Environment file
cp .env.example .env
# Edit .env — set NEXTAUTH_SECRET to any long random string

# 3. Start PostgreSQL (Docker) — first time only
docker run --name mtms-postgres \
  -e POSTGRES_USER=mtms_admin \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=mtms \
  -p 5433:5432 \
  -d postgres:16

# 4. Create schema + seed demo accounts (empty database, no old deliveries)
npm run db:reset

# 5. Start the app
npm run dev          # HTTPS + network URL (phone/tablet on same Wi‑Fi — QR camera)
# or
npm run dev:local    # http://localhost:3000 only (PC browser)
```

Open **https://localhost:3000** (or the Phone URL printed in the terminal) and log in (see **Demo Accounts** below).

### Phone / QR camera testing

`npm run dev` starts **HTTPS** so the warehouse QR scanner can use the camera on mobile.

1. Run `npm run dev` on your PC.
2. On your phone (same Wi‑Fi), open the **Phone:** URL from the terminal (e.g. `https://192.168.x.x:3000`).
3. If the browser shows a certificate warning, tap **Advanced** → **Proceed** / **Continue** (self-signed dev certificate).
4. If you see **ERR_SSL_PROTOCOL_ERROR**, stop the server, run `npm run dev` again, and copy the **Phone:** URL exactly (must start with `https://`). If connection fails, try an address under **Other IPs** (use your **Wi-Fi** IP, not `192.168.137.x` hotspot).
5. Log in as `staff@maruichi.jp` and use **Open QR camera** on Factory Requests.

To run without HTTPS (camera will not work on phone): `$env:DEV_HTTP="1"; npm run dev` (PowerShell).

### `.env` example

```env
DATABASE_URL="postgresql://mtms_admin:password@localhost:5433/mtms?schema=public"
DIRECT_URL="postgresql://mtms_admin:password@localhost:5433/mtms?schema=public"
NEXTAUTH_SECRET="change-me-to-a-long-random-string"
NEXTAUTH_URL="http://localhost:3000"
```

---

## Reset database (wipe all deliveries & reseed)

Use this when testing went wrong, trucks/drivers look stuck, or you want a clean demo state.

**Windows (PowerShell):**

```powershell
docker start mtms-postgres
cd "path\to\Nakama"
npm run db:reset
```

**macOS / Linux:**

```bash
docker start mtms-postgres
cd path/to/Nakama
npm run db:reset
```

What `npm run db:reset` does:

1. `prisma db push --force-reset` — drops all tables and recreates schema (removes every order, trip, assignment, delivery record)
2. `npm run db:seed` — recreates companies, staff users, Shinwa drivers, internal fleet drivers (小野 / 浅川), trucks

**After reset:** log out and log back in (old JWT sessions point to deleted users).

### Manual equivalent

```bash
docker start mtms-postgres
npx prisma db push --force-reset
npm run db:seed
```

### Yokomochi-only reset (keep other TMS data)

Rarely needed; full reset is preferred for demos:

```bash
npm run db:yokomochi-reset
npm run db:seed
```

---

## Demo Accounts

Password for all: **password123**

| Email | Role | Dashboard |
|-------|------|-----------|
| staff@maruichi.jp | 20号物流センター (Warehouse) | `/warehouse` |
| staff@keycoffee.jp | キーコーヒー飲料工場 (Factory) | `/factory/requests` |
| staff@shinwa.jp | 建会社 (Carrier) | `/carrier/requests` |
| staff@kansai-logistics.jp | Subcontractor | `/subcontractor` |
| htetpaing@shinwa.jp | Driver — Htet Paing | `/driver/active-job` |
| hpone@shinwa.jp | Driver — Hpone | `/driver/active-job` |
| linnkhant@shinwa.jp | Driver — Linn Khant | `/driver/active-job` |
| tutu@shinwa.jp | Driver — TuTu | `/driver/active-job` |
| ono@maruichi.jp | Internal driver — 小野 (WH-10T-A) | `/driver/active-job` |
| asakawa@maruichi.jp | Internal driver — 浅川 (WH-10T-B) | `/driver/active-job` |

Internal fleet trucks: **WH-10T-A**, **WH-10T-B** (10t, 16 pallets/trip)

---

## Key Coffee Yokomochi (横持輸送)

**Docs:** `docs/keycoffee-yokomochi/`

### 5-Phase Workflow

| Phase | Who | Route | Action |
|-------|-----|-------|--------|
| 1 | Warehouse → Factory | `/warehouse/factory-requests` | Create request (boxes + need date) |
| 1 | Factory | `/factory/requests` | Respond FULL / PARTIAL / REJECTED (+ next date for remainder) |
| 1 | Warehouse ↔ Factory | `/warehouse/negotiations` | Review reply, **live chat (SSE)**, Approve / Negotiate |
| 2 | Warehouse | `/warehouse/negotiations` | **Approve** → auto-creates `DeliverySchedule` legs (e.g. 70 + 30 boxes) |
| 2 | Warehouse | `/warehouse/internal-fleet` | Daily driver calendar (小野 / 浅川) — drag & resize trips by date |
| 3 | Warehouse | `/warehouse/external-carrier` | Send **remaining** trips to 新和 **per schedule date** |
| 3 | Carrier | `/carrier/requests` | Date-specific response (truck/driver per trip); partial → auto subcontract |
| 3 | Carrier | `/carrier/accepted` | Assign Shinwa drivers |
| 4 | Driver | `/driver/active-job` | 工場到着 → 積込 → 配送 → 倉庫到着 |
| 5 | Warehouse | `/warehouse/factory-requests` | Scan trip QR / approve arrival |

**Partial delivery example:** 100 boxes need 2026-06-20 → Factory PARTIAL: 70 on Jun 20, 30 on Jun 25 → Warehouse Approve → Schedule 1 (70) + Schedule 2 (30).

**Trip rule:** 10t = **16 pallets/trip** (16 boxes/pallet in UI) → `totalTrips = ceil(pallets / 16)`

**AWS target architecture:** `docs/keycoffee-yokomochi/08_AWS_ARCHITECTURE.md` (Amplify, RDS PostgreSQL, S3, SSE → WebSocket)

### Demo flow (recommended)

1. **Warehouse** — create **100 boxes**, need date **2026-06-20**  
2. **Factory** — PARTIAL: **70 boxes** Jun 20, next date **Jun 25** for **30 boxes**  
3. **Warehouse** — `/warehouse/negotiations` → chat with factory → **Approve** (2 delivery schedules created)  
4. **Internal Fleet** — pick **2026-06-20**, assign 小野 / 浅川 on resource calendar  
5. **External Carrier** — send remaining trips for **Jun 20** schedule to 建会社  
6. **Carrier** — respond (e.g. 1 of 2 trips) → subcontract auto-created for remainder  
7. **Driver** — complete trip steps  
8. **Warehouse** — scan trip code → Approve Arrival  
9. Repeat internal/carrier scheduling for **Jun 25** (30 boxes leg)

---

## NPM scripts (database)

| Command | Description |
|---------|-------------|
| `npm run db:reset` | **Full wipe + seed** (recommended) |
| `npm run db:seed` | Seed only (schema must exist) |
| `npm run db:push` | Apply schema without wiping data |
| `npm run db:studio` | Prisma Studio GUI |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Can't reach database server at localhost:5433` | `docker start mtms-postgres` |
| Login works but actions fail after DB reset | Log out and log back in |
| Empty truck dropdown on Internal Fleet | `npm run db:reset`, or driver finished trip → trucks released at 倉庫到着 |
| QR camera says HTTPS required on phone | Use `npm run dev`, open **https://** Phone URL, accept certificate warning |
| `ERR_SSL_PROTOCOL_ERROR` on phone | Server is HTTP but URL is HTTPS (or wrong IP). Restart `npm run dev` and use the **Phone:** URL from terminal. Try **Wi-Fi** IP if listed under "Other IPs" |
| APPROVED but no trips | Click **配車便数を計算** on Factory Requests |
| Factory FK error on create | Re-login as `staff@maruichi.jp` |
| Prisma EPERM on Windows during reset | Stop `npm run dev`, then run `npm run db:reset` again |

---

## Project Structure

```
app/(dashboard)/warehouse|factory|carrier|driver/
app/actions/yokomochi.ts
components/yokomochi/
docs/keycoffee-yokomochi/
lib/yokomochi/
prisma/schema.prisma
prisma/seed.ts
```

## License

Proprietary — Maruichi Souko Company
