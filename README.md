# Maruichi Transport Management System (MTMS)

Production-ready B2B Logistics and Fleet Management System replacing Google Sheets, phone calls, and fax with a unified web platform.

## Tech Stack

- **Frontend:** Next.js 14 App Router, TypeScript, TailwindCSS, Shadcn UI
- **Backend:** Next.js Route Handlers, Server Actions
- **Database:** AWS RDS PostgreSQL with Prisma ORM
- **Auth:** NextAuth (JWT + Credentials)
- **Storage:** AWS S3 (presigned URLs)
- **Real-time:** Server-Sent Events (SSE)
- **Charts:** Recharts
- **Deployment:** AWS Amplify
- **Infrastructure:** AWS CDK

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start PostgreSQL locally (Docker)
docker run --name mtms-postgres -e POSTGRES_USER=mtms_admin -e POSTGRES_PASSWORD=password -e POSTGRES_DB=mtms -p 5433:5432 -d postgres:16

# Update .env with local database URL
# DATABASE_URL="postgresql://mtms_admin:password@localhost:5433/mtms?schema=public"
# DIRECT_URL="postgresql://mtms_admin:password@localhost:5433/mtms?schema=public"
# NEXTAUTH_SECRET="your-secret-here"

# Run migrations and seed
npx prisma migrate dev --name init
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo Accounts

| Email | Role | Password |
|-------|------|----------|
| staff@maruichi.jp | Maruichi Staff | password123 |
| staff@shinwa.jp | Shinwa Staff | password123 |
| staff@kansai-logistics.jp | Subcontractor | password123 |
| driver@shinwa.jp | Driver | password123 |

## Project Structure

```
app/
  (auth)/login/           # Authentication
  (dashboard)/
    maruichi/             # Shipper dashboard
    shinwa/               # Carrier dashboard
    subcontractor/        # Subcontractor dashboard
    driver/               # Mobile driver dashboard
  api/
    auth/                 # NextAuth
    transport/            # Transport API
    notifications/        # Notifications + SSE stream
    upload/presign/       # S3 presigned URLs
  actions/                # Server Actions
components/
  forms/ tables/ charts/ cards/ dialogs/ layout/
lib/
  prisma/ auth/ s3/ sse/ rbac/
infrastructure/           # AWS CDK
prisma/                   # Schema + migrations + seed
```

## AWS Deployment

### 1. Deploy Infrastructure (CDK)

```bash
cd infrastructure
npm install
npx cdk bootstrap
npx cdk deploy
```

### 2. Configure Amplify Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Pooled connection string (with pgbouncer) |
| `DIRECT_URL` | Direct RDS connection for migrations |
| `NEXTAUTH_URL` | Amplify app URL |
| `NEXTAUTH_SECRET` | JWT secret (32+ chars) |
| `AWS_REGION` | ap-northeast-1 |
| `AWS_S3_BUCKET_NAME` | From CDK output |
| `AWS_ACCESS_KEY_ID` | IAM credentials |
| `AWS_SECRET_ACCESS_KEY` | IAM credentials |

### 3. RDS Connection Pooling

Use Prisma connection pooling with PgBouncer or RDS Proxy:

```
DATABASE_URL="postgresql://user:pass@host:5432/mtms?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://user:pass@host:5432/mtms"
```

### 4. Backup Strategy

- RDS automated backups: 7-day retention (configured in CDK)
- Point-in-time recovery enabled
- S3 versioning for upload files
- Run `prisma migrate deploy` in CI/CD pipeline

## Production Best Practices

1. **Security:** Rotate `NEXTAUTH_SECRET` quarterly; use AWS Secrets Manager for DB credentials
2. **Database:** Enable RDS Multi-AZ for production; use RDS Proxy for connection pooling
3. **Monitoring:** Add CloudWatch alarms for RDS CPU, connections, and Amplify build failures
4. **SSE Scaling:** For multi-instance deployments, replace in-memory SSE with Redis pub/sub or API Gateway WebSocket
5. **Rate Limiting:** Add middleware rate limiting on `/api/auth` and `/api/upload`
6. **HTTPS:** Enforce via Amplify custom domain with ACM certificate
7. **CORS:** Restrict S3 CORS to your Amplify domain in production
8. **Audit:** Enable CloudTrail and RDS audit logging for compliance

## License

Proprietary — Maruichi Souko Company
