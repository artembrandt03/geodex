-- DropIndex
DROP INDEX "GameResult_userId_idx";

-- AlterTable
ALTER TABLE "GameResult" ADD COLUMN     "bestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "neighborCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scoringVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "totalTimeMs" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "GameResult_userId_createdAt_idx" ON "GameResult"("userId", "createdAt");
