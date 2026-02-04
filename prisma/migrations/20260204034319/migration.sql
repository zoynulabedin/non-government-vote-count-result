-- CreateEnum
CREATE TYPE "UnionType" AS ENUM ('UNION', 'POURASHAVA');

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "constituencyId" TEXT,
ADD COLUMN     "seatNumber" TEXT;

-- AlterTable
ALTER TABLE "Union" ADD COLUMN     "type" "UnionType" NOT NULL DEFAULT 'UNION';

-- AlterTable
ALTER TABLE "Upazila" ADD COLUMN     "constituencyId" TEXT;

-- CreateTable
CREATE TABLE "Constituency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,

    CONSTRAINT "Constituency_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Constituency" ADD CONSTRAINT "Constituency_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upazila" ADD CONSTRAINT "Upazila_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
