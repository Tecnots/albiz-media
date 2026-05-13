import net from "net";

const client = new net.Socket();
client.connect(54322, "127.0.0.1", () => {
  console.log("Port 54322 is open!");
  client.destroy();
});

client.on("error", (err) => {
  console.error("Connection failed:", err.message);
});
