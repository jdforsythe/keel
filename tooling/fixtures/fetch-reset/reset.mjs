// Run by test/node-fetch.test.ts under `--import node-fetch.mjs`: 1,000 fetches to a server that resets every
// connection; prints how many failed as rejections and how many escaped as uncaught errors.
import net from "node:net";

let uncaught = 0;
let rejected = 0;
process.on("uncaughtException", () => {
  uncaught++;
});
const server = net.createServer((c) => c.resetAndDestroy());
server.listen(0, "127.0.0.1", async () => {
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  for (let k = 0; k < 25; k++)
    await Promise.all(Array.from({ length: 40 }, () => fetch(`http://127.0.0.1:${port}/`).catch(() => rejected++)));
  process.stdout.write(`${JSON.stringify({ uncaught, rejected })}\n`);
  server.close();
});
