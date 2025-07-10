-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('SHELTER', 'WATER', 'FOOD', 'WIFI');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('NEED_HELP', 'OFFERING_HELP');

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "generatedById" INTEGER,
    "location" JSONB,
    "description" TEXT,
    "activityType" "ActivityType" NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'NEED_HELP',
    "externalStorageId" TEXT,
    "errorMessage" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Activity_externalStorageId_key" ON "Activity"("externalStorageId");

-- CreateIndex
CREATE INDEX "Activity_generatedById_idx" ON "Activity"("generatedById");

-- CreateIndex
CREATE INDEX "Activity_status_idx" ON "Activity"("status");

-- CreateIndex
CREATE INDEX "Activity_activityType_idx" ON "Activity"("activityType");

-- CreateIndex
CREATE INDEX "Activity_externalStorageId_idx" ON "Activity"("externalStorageId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
