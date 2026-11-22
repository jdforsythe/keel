// Run by realNet.example.test.ts in a plain `node` (no test preload): `rounds` × 40 concurrent fetches, through a real
// ctx's `net` (`ctx`) or the global fetch with no ctx made (`global`), to a server that resets every connection as it is set up, then one
// to a refused port. Prints the uncaught errors, the rejections by name and cause code, and the refused fetch's.
import net from "node:net";
import { createCtx } from "../../src/index.ts";

const via = process.argv[2] === "global" ? "global" : "ctx";
const rounds = Number(process.argv[3] ?? "25");
const ctx = via === "ctx" ? createCtx({ mode: "real", seed: 1337 }) : undefined;
const send = (url: string): Promise<Response> => (ctx === undefined ? fetch(url) : ctx.net.fetch(new Request(url)));

const uncaught: string[] = [];
process.on("uncaughtException", (error) => {
  uncaught.push(`${error.message}\n${error.stack ?? ""}`);
});

/** `reason`'s name and its cause's code, as `TypeError:ECONNRESET`. */
const nameOf = (reason: unknown): string => {
  if (!(reason instanceof Error)) return String(reason);
  const cause: unknown = reason.cause;
  const code = typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : "";
  return `${reason.name}:${code}`;
};

const rejected: Record<string, number> = {};
let answered = 0;
const server = net.createServer((c) => c.resetAndDestroy());
await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
const address = server.address();
const port = typeof address === "object" && address !== null ? address.port : 0;
for (let k = 0; k < rounds; k++)
  await Promise.all(
    Array.from({ length: 40 }, () =>
      send(`http://127.0.0.1:${port}/`).then(
        () => {
          answered++;
        },
        (reason: unknown) => {
          const name = nameOf(reason);
          rejected[name] = (rejected[name] ?? 0) + 1;
        },
      ),
    ),
  );
await new Promise<void>((done) => server.close(() => done()));
const refused = await send(`http://127.0.0.1:${port}/`).then(
  () => "answered",
  (reason: unknown) => nameOf(reason),
);
process.stdout.write(`${JSON.stringify({ uncaught, rejected, answered, refused })}\n`);
