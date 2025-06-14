/*
  Warnings:

  - The values [USER_LIST] on the enum `ReportType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ReportType_new" AS ENUM ('DISASTER_INCIDENT');
ALTER TABLE "Report" ALTER COLUMN "reportType" TYPE "ReportType_new" USING ("reportType"::text::"ReportType_new");
ALTER TYPE "ReportType" RENAME TO "ReportType_old";
ALTER TYPE "ReportType_new" RENAME TO "ReportType";
DROP TYPE "ReportType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "city" TEXT DEFAULT '',
ADD COLUMN     "country" TEXT DEFAULT '';
