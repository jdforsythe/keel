import { createServer } from "node:net";

/** A port the OS gives on 127.0.0.1, free when it is read (a start that loses the race retries, k.e2e serve). */
export function freePort(): Promise<number> {
  return new Promise((done, failed) => {
    const s = createServer();
    s.once("error", failed);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      const port = typeof a === "object" && a !== null ? a.port : 0;
      s.close(() => done(port));
    });
  });
}
