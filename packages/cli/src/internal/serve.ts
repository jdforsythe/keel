import type { StdioServer } from "../types/StdioServer.ts";

/** Binary only: pipe stdin through a protocol server to stdout, in order; exit when the server is done. */
export function serve(server: StdioServer): void {
  let queue = Promise.resolve();
  process.stdin.on("data", (chunk: Uint8Array) => {
    queue = queue
      .then(() => server.receive(chunk))
      .then((out) => {
        if (out !== "") process.stdout.write(out);
        if (server.done()) process.exit(0);
      });
  });
  process.stdin.on("end", () => {
    void queue.then(() => process.exit(0));
  });
}
