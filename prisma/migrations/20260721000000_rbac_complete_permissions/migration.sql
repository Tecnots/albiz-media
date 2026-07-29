-- Add missing permissions (idempotent)
INSERT INTO "Permission" ("key", "label") VALUES
  ('interact_posts', 'Like, save, and share content'),
  ('comment', 'Comment on posts and shorts'),
  ('follow_users', 'Follow, block, and mute users'),
  ('create_stories', 'Create stories'),
  ('send_messages', 'Send direct messages'),
  ('publish_articles', 'Publish approved articles'),
  ('approve_circle', 'Approve Circle applications'),
  ('manage_sections', 'Manage content sections'),
  ('moderate_shorts', 'Moderate short videos'),
  ('manage_ads', 'Manage ad campaigns'),
  ('manage_campaigns', 'Create and send broadcasts'),
  ('manage_domains', 'Manage custom domains'),
  ('manage_music', 'Manage story music tracks'),
  ('manage_jobs', 'Manage background jobs'),
  ('manage_notifications', 'Manage admin notifications'),
  ('manage_emails', 'Manage email templates'),
  ('view_admin_analytics', 'View platform-wide analytics'),
  ('circle_apply', 'Apply for Circle membership'),
  ('access_author_studio', 'Access Author Studio'),
  ('manage_roles', 'Manage roles and permissions'),
  ('view_audit_logs', 'View audit logs')
ON CONFLICT ("key") DO NOTHING;

-- Remove incorrect role-permission mappings from original seed
DELETE FROM "RolePermission" rp
USING "Permission" p
WHERE rp."permissionId" = p."id"
AND (rp."role", p."key") IN (
  ('NORMAL'::"UserRole", 'create_posts'),
  ('AUTHOR'::"UserRole", 'create_posts'),
  ('AUTHOR'::"UserRole", 'view_circle'),
  ('AUTHOR'::"UserRole", 'access_admin')
);

-- Add correct role-permission mappings (idempotent)
INSERT INTO "RolePermission" ("role", "permissionId")
SELECT r.role::"UserRole", p.id FROM (VALUES
  -- Social engagement: ALL roles
  ('ADMIN', 'interact_posts'), ('EDITOR', 'interact_posts'), ('AUTHOR', 'interact_posts'),
  ('UPLOADER', 'interact_posts'), ('CIRCLE', 'interact_posts'), ('NORMAL', 'interact_posts'),
  ('ADMIN', 'comment'), ('EDITOR', 'comment'), ('AUTHOR', 'comment'),
  ('UPLOADER', 'comment'), ('CIRCLE', 'comment'), ('NORMAL', 'comment'),
  ('ADMIN', 'follow_users'), ('EDITOR', 'follow_users'), ('AUTHOR', 'follow_users'),
  ('UPLOADER', 'follow_users'), ('CIRCLE', 'follow_users'), ('NORMAL', 'follow_users'),
  -- Content creation: ADMIN, CIRCLE
  ('ADMIN', 'create_stories'), ('CIRCLE', 'create_stories'),
  ('ADMIN', 'send_messages'), ('CIRCLE', 'send_messages'),
  -- write_articles: add CIRCLE (ADMIN+AUTHOR already seeded)
  ('CIRCLE', 'write_articles'),
  -- Editor workflow
  ('ADMIN', 'publish_articles'), ('EDITOR', 'publish_articles'),
  -- Author Studio access
  ('ADMIN', 'access_author_studio'), ('AUTHOR', 'access_author_studio'),
  -- Admin-only operations
  ('ADMIN', 'approve_circle'),
  ('ADMIN', 'manage_sections'),
  ('ADMIN', 'moderate_shorts'),
  ('ADMIN', 'manage_ads'),
  ('ADMIN', 'manage_campaigns'),
  ('ADMIN', 'manage_domains'),
  ('ADMIN', 'manage_music'),
  ('ADMIN', 'manage_jobs'),
  ('ADMIN', 'manage_notifications'),
  ('ADMIN', 'manage_emails'),
  ('ADMIN', 'view_admin_analytics'),
  ('ADMIN', 'manage_roles'),
  ('ADMIN', 'view_audit_logs'),
  -- Circle applications: NORMAL, AUTHOR, UPLOADER
  ('NORMAL', 'circle_apply'), ('AUTHOR', 'circle_apply'), ('UPLOADER', 'circle_apply'),
  -- Analytics: add EDITOR and UPLOADER (ADMIN+AUTHOR already seeded)
  ('EDITOR', 'view_analytics'), ('UPLOADER', 'view_analytics')
) AS r(role, pkey)
JOIN "Permission" p ON p."key" = r.pkey
ON CONFLICT ("role", "permissionId") DO NOTHING;
