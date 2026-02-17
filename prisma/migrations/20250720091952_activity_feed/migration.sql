-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('REQUEST', 'OFFER');

-- CreateEnum
CREATE TYPE "HelpType" AS ENUM ('FOOD', 'WATER', 'SHELTER', 'WIFI');

-- CreateTable
CREATE TABLE "ActivityFeedPost" (
    "id" TEXT NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "postedById" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityFeedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpItem" (
    "id" TEXT NOT NULL,
    "helpType" "HelpType" NOT NULL,
    "quantity" INTEGER,
    "activityFeedPostId" TEXT NOT NULL,

    CONSTRAINT "HelpItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityFeedPost_postedById_idx" ON "ActivityFeedPost"("postedById");

-- CreateIndex
CREATE INDEX "HelpItem_activityFeedPostId_idx" ON "HelpItem"("activityFeedPostId");

-- AddForeignKey
ALTER TABLE "ActivityFeedPost" ADD CONSTRAINT "ActivityFeedPost_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpItem" ADD CONSTRAINT "HelpItem_activityFeedPostId_fkey" FOREIGN KEY ("activityFeedPostId") REFERENCES "ActivityFeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
