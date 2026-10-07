-- AlterTable
ALTER TABLE "GameResult" ADD COLUMN     "roundNonce" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_roundNonce_key" ON "GameResult"("roundNonce");

