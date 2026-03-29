# Local Development Setup

This guide covers running `apps/web` locally with a Postgres database.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for the database)
- Node.js 20+
- npm

## 1. Start the database

From `apps/web`:

```bash
docker compose up -d
```

This starts a Postgres 16 container on port `5432` with:

- user: `postgres`
- password: `postgres`
- database: `pv_manager`

Data is persisted in a named Docker volume (`pv_manager_postgres`) across restarts.

To stop it:

```bash
docker compose down
```

To stop and delete all data:

```bash
docker compose down -v
```

## 2. Set up environment variables

From `apps/web`, copy the example env file:

```bash
cp .env.example .env
```

The default value matches the Docker Compose setup and requires no edits:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/pv_manager
```

> `.env` is loaded by both the Next.js dev server and the Drizzle CLI commands.

## 3. Install dependencies

From `apps/web`:

```bash
npm install
```

## 4. Push the schema

This syncs the Drizzle schema to the local database:

```bash
npm run db:push
```

Confirm the prompt to apply the schema. This is safe to re-run — it is idempotent.

## 5. Seed the database

```bash
npm run db:seed
```

This inserts a single deterministic fixture user with installation, tariff history, and 14 days of daily summaries spanning a tariff-rate change. The seed is idempotent and safe to re-run.

Expected output:

```
  users: ok
  installations: ok
  provider_connections: ok
  tariff_plans: ok
  tariff_plan_versions: ok
  tariff_fixed_charge_versions: ok
  daily_summaries: ok (14 rows)
Seed complete.
```

## 6. Verify

Connect to the database and confirm the seeded rows:

```bash
docker exec -it $(docker compose ps -q postgres) psql -U postgres -d pv_manager
```

Then run:

```sql
SELECT COUNT(*) FROM users;           -- expect 1
SELECT COUNT(*) FROM installations;   -- expect 1
SELECT COUNT(*) FROM daily_summaries; -- expect 14
```

## 7. Start the app

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Alternative: native Postgres

If you already have Postgres running locally, skip the Docker steps and:

1. Create the database: `createdb pv_manager`
2. Set `DATABASE_URL` in `.env` to match your local connection string
3. Continue from step 4 above

The default `.env.example` value assumes the Docker setup credentials. Adjust as needed for your local install.
