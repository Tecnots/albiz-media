import { sendPushToUser } from "@/lib/fcm-send";
import type { JobPayloads } from "@/lib/job-queue";

export async function processPushJob(
  payload: JobPayloads["send-push"]
): Promise<void> {
  await sendPushToUser(payload.userId, {
    title: payload.title,
    body:  payload.body,
    url:   payload.url,
    icon:  payload.icon,
    image: payload.image,
  });
}