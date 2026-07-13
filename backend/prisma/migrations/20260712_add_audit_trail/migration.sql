-- CreateTable AuditLog
CREATE TABLE "audit_logs" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "table" TEXT NOT NULL,
  "recordId" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "adminId" INTEGER NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "ip" TEXT NOT NULL,
  "userAgent" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex for efficient queries
CREATE INDEX "audit_logs_table_recordId_idx" ON "audit_logs"("table", "recordId");
CREATE INDEX "audit_logs_adminId_timestamp_idx" ON "audit_logs"("adminId", "timestamp");
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");
