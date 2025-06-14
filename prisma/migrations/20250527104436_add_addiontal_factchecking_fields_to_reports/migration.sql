-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "factCheckLastUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "factCheckOverallPercentage" INTEGER DEFAULT 0,
ADD COLUMN     "factCheckStatus" TEXT DEFAULT '';
