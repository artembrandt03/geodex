-- CreateEnum
CREATE TYPE "RoundEventKind" AS ENUM ('STARTED', 'FINISHED', 'ENDED');

-- CreateEnum
CREATE TYPE "RoundEndReason" AS ENUM ('LEFT_TAB', 'INACTIVE');

-- CreateTable
CREATE TABLE "UserActivityDay" (
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "UserActivityDay_pkey" PRIMARY KEY ("userId","day")
);

-- CreateTable
CREATE TABLE "RoundEvent" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "kind" "RoundEventKind" NOT NULL,
    "mode" "GameMode" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "roundLength" INTEGER NOT NULL,
    "signedIn" BOOLEAN NOT NULL,
    "endReason" "RoundEndReason",
    "answered" INTEGER,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCounter" (
    "day" DATE NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyCounter_pkey" PRIMARY KEY ("day","key")
);

-- CreateTable
CREATE TABLE "DailyVisitor" (
    "day" DATE NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "DailyVisitor_pkey" PRIMARY KEY ("day","hash")
);

-- CreateIndex
CREATE INDEX "UserActivityDay_day_idx" ON "UserActivityDay"("day");

-- CreateIndex
CREATE INDEX "RoundEvent_createdAt_idx" ON "RoundEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoundEvent_roundId_kind_key" ON "RoundEvent"("roundId", "kind");

-- CreateIndex
CREATE INDEX "DailyCounter_key_day_idx" ON "DailyCounter"("key", "day");

-- AddForeignKey
ALTER TABLE "UserActivityDay" ADD CONSTRAINT "UserActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

