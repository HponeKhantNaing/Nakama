# AWS Architecture — Key Coffee Yokomochi MTMS

Production deployment target for the 20号物流センター横持輸送 system.

## Overview

```
┌─────────────┐     HTTPS      ┌──────────────────┐
│  Amplify    │ ◄────────────► │  Next.js 14 SSR  │
│  Hosting    │                │  + Server Actions│
└─────────────┘                └────────┬─────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
            ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
            │ RDS Postgres │   │  S3 Bucket   │   │ SSE (HTTP)   │
            │  (Prisma)    │   │  POD / QR    │   │ Chat / Notify│
            └──────────────┘   └──────────────┘   └──────────────┘
                                        │
                              Future: API Gateway WebSocket
```

## Components

| Layer | AWS Service | Purpose |
|-------|-------------|---------|
| Frontend | **Amplify Hosting** | Next.js App Router, SSR, env vars (`DATABASE_URL`, `NEXTAUTH_SECRET`) |
| API | **Amplify SSR / Lambda@Edge** | Server Actions, Route Handlers (`/api/negotiation/*/stream`) |
| Database | **RDS PostgreSQL 16** | `FactoryNegotiation`, `DeliverySchedule`, `NegotiationChatMessage`, trips |
| Files | **S3** | Proof-of-delivery photos, exported delivery forms, QR assets |
| Realtime | **SSE (today)** | Negotiation chat, notification stream — no external SaaS |
| Realtime (future) | **API Gateway WebSocket** | Bidirectional chat, live driver GPS |
| Secrets | **Secrets Manager** | DB credentials, NextAuth secret |
| CI/CD | **Amplify Git connect** | `main` → build → deploy |

## Data model (negotiation flow)

- **FactoryRequest** — original 100 boxes, need date
- **FactoryNegotiation** — factory reply 70 + remaining 30 + next date
- **DeliverySchedule** — warehouse-approved legs (Jun 20: 70, Jun 25: 30)
- **YokomochiTrip** — per schedule date, linked via `deliveryScheduleId`
- **CarrierRequest** — per `deliveryScheduleId` + `deliveryDate` for Shinwa
- **NegotiationChatMessage** — warehouse ↔ factory audit trail

## Environment variables (Amplify)

```env
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/mtms
DIRECT_URL=postgresql://user:pass@rds-endpoint:5432/mtms
NEXTAUTH_URL=https://your-app.amplifyapp.com
NEXTAUTH_SECRET=<from-secrets-manager>
AWS_REGION=ap-northeast-1
S3_BUCKET=mtms-yokomochi-assets
```

## SSE endpoints (compatible with Amplify)

- `GET /api/notifications/stream` — company notifications
- `GET /api/negotiation/[orderId]/stream` — negotiation chat poll (2.5s)

Amplify supports long-lived HTTP for SSE when `Cache-Control: no-cache` and `X-Accel-Buffering: no` are set.

## Migration from local Docker

1. Create RDS PostgreSQL in same VPC as Amplify (or use public RDS + security group for demo)
2. Run `npx prisma db push` from CI or one-off ECS task
3. Run `npm run db:seed` once
4. Point Amplify env to RDS URL

## Security

- RDS in private subnet; Amplify via VPC connector
- S3 bucket policy: app role only
- NextAuth JWT; role-based routes in middleware

## Future WebSocket migration

Replace negotiation SSE poll with API Gateway WebSocket + Lambda posting to `NegotiationChatMessage` — client API unchanged at action layer.
