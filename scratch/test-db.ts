import { Client } from "pg";
import "dotenv/config";

async function test() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
  });

  try {
    console.log(`Connecting to: ${process.env.DIRECT_URL}`);
    await client.connect();
    console.log("Connected successfully to PG!");
    const res = await client.query("SELECT COUNT(*) FROM \"User\"");
    console.log("User count:", res.rows[0].count);
  } catch (err) {
    console.error("Connection error:", err);
  } finally {
    await client.end();
  }
}

test();
