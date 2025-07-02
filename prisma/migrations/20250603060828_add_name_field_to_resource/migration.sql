-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('SURVIVAL', 'HOTLINE', 'FIRST_AID');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('PENDING', 'PROCESSING', 'AWAITING_DETAILS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "generatedById" INTEGER,
    "location" JSONB,
    "description" TEXT,
    "resourceType" "ResourceType" NOT NULL,
    "status" "ResourceStatus" NOT NULL DEFAULT 'PENDING',
    "externalStorageId" TEXT,
    "errorMessage" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Resource_externalStorageId_key" ON "Resource"("externalStorageId");

-- CreateIndex
CREATE INDEX "Resource_generatedById_idx" ON "Resource"("generatedById");

-- CreateIndex
CREATE INDEX "Resource_status_idx" ON "Resource"("status");

-- CreateIndex
CREATE INDEX "Resource_resourceType_idx" ON "Resource"("resourceType");

-- CreateIndex
CREATE INDEX "Resource_externalStorageId_idx" ON "Resource"("externalStorageId");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
