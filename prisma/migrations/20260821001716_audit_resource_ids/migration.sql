-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "resource_ids" TEXT[],
ADD COLUMN     "resource_type" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_resource_ids_idx" ON "audit_logs" USING GIN ("resource_ids");
