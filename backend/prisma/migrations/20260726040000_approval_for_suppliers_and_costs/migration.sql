ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'SUPPLIER';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'TOUR_COST';

ALTER TABLE "Supplier" ADD COLUMN "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "TourCost" ADD COLUMN "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT';

CREATE INDEX "Supplier_status_idx" ON "Supplier"("status");
CREATE INDEX "TourCost_status_idx" ON "TourCost"("status");
