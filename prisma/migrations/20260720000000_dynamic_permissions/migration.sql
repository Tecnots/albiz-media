-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" SERIAL NOT NULL,
    "role" "UserRole" NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_permissionId_key" ON "RolePermission"("role", "permissionId");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default permissions
INSERT INTO "Permission" ("key", "label") VALUES
  ('view_feed', 'View feed & posts'),
  ('create_posts', 'Create posts'),
  ('view_circle', 'View Circle content'),
  ('write_articles', 'Write & publish articles'),
  ('access_editor', 'Access Editor Studio'),
  ('review_articles', 'Review & approve articles'),
  ('upload_shorts', 'Upload short-form videos'),
  ('access_shorts_dashboard', 'Access Shorts dashboard'),
  ('access_admin', 'Access admin panel'),
  ('manage_content', 'Manage content & posts'),
  ('manage_users', 'Manage users'),
  ('invite_users', 'Invite users to roles'),
  ('view_analytics', 'View analytics'),
  ('platform_settings', 'Platform settings');

-- Seed default role-permission mappings
INSERT INTO "RolePermission" ("role", "permissionId")
SELECT r.role, p.id FROM (VALUES
  ('NORMAL', 'view_feed'), ('NORMAL', 'create_posts'),
  ('CIRCLE', 'view_feed'), ('CIRCLE', 'create_posts'), ('CIRCLE', 'view_circle'),
  ('AUTHOR', 'view_feed'), ('AUTHOR', 'create_posts'), ('AUTHOR', 'view_circle'),
  ('AUTHOR', 'write_articles'), ('AUTHOR', 'access_admin'), ('AUTHOR', 'view_analytics'),
  ('EDITOR', 'view_feed'), ('EDITOR', 'access_editor'), ('EDITOR', 'review_articles'),
  ('UPLOADER', 'view_feed'), ('UPLOADER', 'upload_shorts'), ('UPLOADER', 'access_shorts_dashboard'),
  ('ADMIN', 'view_feed'), ('ADMIN', 'create_posts'), ('ADMIN', 'view_circle'),
  ('ADMIN', 'write_articles'), ('ADMIN', 'access_editor'), ('ADMIN', 'review_articles'),
  ('ADMIN', 'upload_shorts'), ('ADMIN', 'access_shorts_dashboard'), ('ADMIN', 'access_admin'),
  ('ADMIN', 'manage_content'), ('ADMIN', 'manage_users'), ('ADMIN', 'invite_users'),
  ('ADMIN', 'view_analytics'), ('ADMIN', 'platform_settings')
) AS r(role, pkey)
JOIN "Permission" p ON p."key" = r.pkey;
