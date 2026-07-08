-- Adds STORY_QUESTION_RESPONSE alongside the existing LIKE_STORY pattern, so
-- answering a Question sticker notifies the story owner through the same
-- Notification table/push/email plumbing every other Story interaction uses.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'STORY_QUESTION_RESPONSE';
