## Overview
A web application slice that turns raw receipts into an organized expense report grouped by currency and category, with complete audit traceability back to source receipts.

## Architecture
- **Web App**: Next.js (App Router), TypeScript, Tailwind CSS
- **Database & Queue**: PostgreSQL with Prisma and a separate long-lived Node worker
- **Storage**: Cloudflare R2 (or MinIO for local development) via `@aws-sdk/client-s3`
- **AI Processing**: Google Gemini API via official `@google/genai` SDK

## Local Development
1. Start PostgreSQL and MinIO:
   ```bash
   docker compose up -d
   ```
2. Copy `.env.example` to `.env` and fill in secrets by hand.
3. Apply database migrations:
   ```bash
   npm run db:migrate
   ```
4. Run web application:
   ```bash
   npm run dev
   ```
5. In a separate terminal, run the queue worker:
   ```bash
   npm run build:worker
   npm run start:worker
   ```

