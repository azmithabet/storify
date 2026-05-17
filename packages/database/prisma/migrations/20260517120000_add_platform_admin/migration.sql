-- Platform-owner admin panel (cross-tenant). Lives in master DB.
-- See packages/database/prisma/schema.prisma for model definitions.

CREATE TYPE "PlatformAdminRole" AS ENUM ('OWNER', 'ADMIN');

CREATE TABLE "platform_admins" (
  "id"            TEXT PRIMARY KEY,
  "email"         VARCHAR(255) NOT NULL,
  "password_hash" TEXT NOT NULL,
  "full_name"     VARCHAR(200) NOT NULL,
  "role"          "PlatformAdminRole" NOT NULL DEFAULT 'ADMIN',
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "last_login"    TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

CREATE TABLE "platform_audit_logs" (
  "id"         TEXT PRIMARY KEY,
  "actor_id"   TEXT NOT NULL,
  "entity"     VARCHAR(100) NOT NULL,
  "entity_id"  VARCHAR(100),
  "action"     VARCHAR(100) NOT NULL,
  "before"     JSONB,
  "after"      JSONB,
  "ip"         VARCHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_audit_logs_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "platform_admins"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_platform_audit_entity"
  ON "platform_audit_logs"("entity", "entity_id", "created_at" DESC);
CREATE INDEX "idx_platform_audit_actor"
  ON "platform_audit_logs"("actor_id", "created_at" DESC);
