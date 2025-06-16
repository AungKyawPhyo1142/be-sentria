/*
  Warnings:

  - The values [PENDING,PROCESSING,AWAITING_DETAILS] on the enum `ReportStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "ReportDBStatus" AS ENUM ('PENDING_FOR_MONGODB_CREATION', 'PUBLISHED_IN_MONGODB', 'FAILED_TO_PUBLISH_IN_MONGODB');

-- AlterEnum
BEGIN;
CREATE TYPE "ReportStatus_new" AS ENUM ('COMPLETED', 'FAILED', 'PUBLISHED_FAILED', 'FACTCHECK_PENDING', 'FACTCHECK_COMPLETE');
ALTER TABLE "Report" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Report" ALTER COLUMN "status" TYPE "ReportStatus_new" USING ("status"::text::"ReportStatus_new");
ALTER TYPE "ReportStatus" RENAME TO "ReportStatus_old";
ALTER TYPE "ReportStatus_new" RENAME TO "ReportStatus";
DROP TYPE "ReportStatus_old";
ALTER TABLE "Report" ALTER COLUMN "status" SET DEFAULT 'FACTCHECK_PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "dbStatus" "ReportDBStatus" NOT NULL DEFAULT 'PENDING_FOR_MONGODB_CREATION',
ALTER COLUMN "status" SET DEFAULT 'FACTCHECK_PENDING';
