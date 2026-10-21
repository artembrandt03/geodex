-- A database login for the admin dashboard that can read only the columns the dashboard needs.
--
-- Why: the dashboard already opens every query inside a read-only transaction, but a role that
-- physically can't write (and can't even see password hashes, email addresses, rate-limit keys or
-- one-time tokens) means a bug in the dashboard, or a stolen connection string, can't do harm.
--
-- Run it once against the database you want to look at, as the database owner (in Neon: the SQL
-- editor, or psql with the owner's connection string), after replacing the password below:
--
--   psql "<owner connection string>" -v ON_ERROR_STOP=1 -f admin/sql/create-readonly-role.sql
--
-- Then put the new login in admin/.env as ADMIN_DATABASE_URL.
-- Run it again after a migration adds columns the dashboard should read (it is safe to repeat).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'geodex_admin_ro') THEN
    CREATE ROLE geodex_admin_ro LOGIN PASSWORD 'CHANGE-ME-to-a-long-random-password';
  END IF;
END
$$;

ALTER ROLE geodex_admin_ro SET default_transaction_read_only = on;
ALTER ROLE geodex_admin_ro SET statement_timeout = '15s';

-- Start from nothing, then grant column by column.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM geodex_admin_ro;
GRANT USAGE ON SCHEMA public TO geodex_admin_ro;

-- Accounts: never email, passwordHash.
GRANT SELECT ("id", "displayName", "profilePublic", "createdAt", "emailVerifiedAt") ON "User" TO geodex_admin_ro;

-- Saved rounds: never roundNonce.
GRANT SELECT ("id", "userId", "mode", "difficulty", "roundLength", "score", "correct", "createdAt",
              "bestStreak", "neighborCount", "scoringVersion", "totalTimeMs") ON "GameResult" TO geodex_admin_ro;

-- Anonymous usage statistics.
GRANT SELECT ("userId", "day") ON "UserActivityDay" TO geodex_admin_ro;
GRANT SELECT ("id", "roundId", "kind", "mode", "difficulty", "roundLength", "signedIn", "endReason",
              "answered", "durationMs", "createdAt") ON "RoundEvent" TO geodex_admin_ro;
GRANT SELECT ("day", "key", "count") ON "DailyCounter" TO geodex_admin_ro;

-- Feedback text, but not the IP hash or user agent.
GRANT SELECT ("id", "kind", "subject", "description", "userId", "createdAt", "attachmentCount",
              "emailedAt", "emailError") ON "Feedback" TO geodex_admin_ro;

-- Rate limits: how many entries per bucket, never the hashed keys.
GRANT SELECT ("bucket", "createdAt") ON "RateLimitHit" TO geodex_admin_ro;

-- Not granted at all: EmailToken (one-time login and reset tokens), DailyVisitor (daily visitor hashes),
-- Country, and Prisma's bookkeeping table. The "Database" tab reads table sizes from Postgres's own
-- statistics views, which every role can see.
