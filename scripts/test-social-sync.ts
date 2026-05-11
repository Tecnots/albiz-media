import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

async function testSync() {
  const connectionId = 1; // Assuming 1 exists, adjust as needed
  const externalUserId = "test_user_123";
  const platform = "twitter";

  console.log("--- Starting Social Sync Diagnostic ---");

  try {
    const conn = await prisma.socialConnection.findFirst({
      where: { platform: "twitter", active: true }
    });

    if (!conn) {
      console.error("No active Twitter connection found in DB. Please connect Twitter first.");
      return;
    }

    console.log(`Found connection: ID ${conn.id}, userId ${conn.userId}, handle ${conn.platformHandle}`);

    // Mock a message
    const externalId = `test_msg_${Date.now()}`;
    const text = "Hello from Albiz diagnostic script!";
    const direction = "inbound";

    console.log(`Attempting to save mock message: ${externalId}`);

    // Re-implementing the core logic here to see where it breaks
    const thread = await prisma.socialThread.upsert({
      where: { connectionId_externalUserId: { connectionId: conn.id, externalUserId } },
      create: {
        connectionId: conn.id,
        externalUserId,
        externalHandle: "@test_handle",
        lastMessageAt: new Date(),
        unreadCount: 1,
      },
      update: {
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    });

    console.log(`Thread ensured: ID ${thread.id}`);

    const msg = await prisma.socialMessage.upsert({
      where: { connectionId_externalId: { connectionId: conn.id, externalId } },
      create: {
        connectionId: conn.id,
        externalId,
        threadId: thread.id,
        text,
        direction,
        createdAt: new Date(),
      },
      update: {
        text,
      },
    });

    console.log(`Message saved: ID ${msg.id}`);
    console.log("--- Diagnostic Complete: SUCCESS ---");

  } catch (err) {
    console.error("--- Diagnostic FAILED ---");
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

testSync();
