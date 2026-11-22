// Run by net-fetch-refused-reset.test.ts in a plain `node` (no test preload): `count` requests in a row through a real
// ctx's `net` to a closed port and `count` to a server that destroys each connection it accepts. Prints the uncaught
// errors and unhandled rejections seen, and each request's outcome by error name.
import net from "node:net";
import { createCtx } from "@keel/ctx";

const count = Number(process.argv[2] ?? "500");
const ctx = createCtx({ mode: "real", seed: 1337 });

const escaped: string[] = [];
process.on("uncaughtException", (error) => {
  escaped.push(`uncaughtException: ${String(error)}`);
});
process.on("unhandledRejection", (reason) => {
  escaped.push(`unhandledRejection: ${String(reason)}`);
});

const portOf = (server: net.Server): number => {
  const address = server.address();
  return typeof address === "object" && address !== null ? address.port : 0;
};

const outcomes = async (port: number): Promise<Record<string, number>> => {
  const seen: Record<string, number> = {};
  for (let i = 0; i < count; i++) {
    const outcome = await ctx.net.fetch(new Request(`http://127.0.0.1:${port}/`)).then(
      () => "answered",
      (reason: unknown) => (reason instanceof TypeError ? "TypeError" : `other:${String(reason)}`),
    );
    seen[outcome] = (seen[outcome] ?? 0) + 1;
  }
  return seen;
};

const closed = net.createServer();
await new Promise<void>((done) => closed.listen(0, "127.0.0.1", done));
const closedPort = portOf(closed);
await new Promise<void>((done) => closed.close(() => done()));
const refused = await outcomes(closedPort);

const dropper = net.createServer((s) => s.destroy());
await new Promise<void>((done) => dropper.listen(0, "127.0.0.1", done));
const reset = await outcomes(portOf(dropper));
await new Promise<void>((done) => dropper.close(() => done()));

// Let any error that would escape a fetch surface before the report.
await new Promise<void>((done) => setImmediate(done));
await new Promise<void>((done) => setImmediate(done));
process.stdout.write(`${JSON.stringify({ escaped, refused, reset })}\n`);
