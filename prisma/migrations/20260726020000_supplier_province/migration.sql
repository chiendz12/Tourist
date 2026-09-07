ALTER TABLE "Supplier" ADD COLUMN "provinceId" TEXT;

CREATE INDEX "Supplier_provinceId_idx" ON "Supplier"("provinceId");

ALTER TABLE "Supplier"
ADD CONSTRAINT "Supplier_provinceId_fkey"
FOREIGN KEY ("provinceId") REFERENCES "Province"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
