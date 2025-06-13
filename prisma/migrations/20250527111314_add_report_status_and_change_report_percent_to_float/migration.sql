-- AlterEnum
ALTER TYPE "ReportStatus" ADD VALUE 'FACTCHECK_COMPLETE';

-- AlterTable
ALTER TABLE "Report" ALTER COLUMN "factCheckOverallPercentage" SET DEFAULT 0,
ALTER COLUMN "factCheckOverallPercentage" SET DATA TYPE DOUBLE PRECISION;
