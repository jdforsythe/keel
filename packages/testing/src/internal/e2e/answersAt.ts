import { request } from "node:http";

/** Whether `origin` gives any HTTP answer to `GET /` within `ms` (k.e2e serve readiness). */
export function answersAt(origin: string, ms: number): Promise<boolean> {
  return new Promise((done) => {
    const req = request(new URL("/", origin), { method: "GET", headers: { accept: "text/html" } }, (res) => {
      res.resume();
      done(true);
    });
    req.on("error", () => done(false));
    req.setTimeout(Math.max(1, ms), () => {
      req.destroy();
      done(false);
    });
    req.end();
  });
}
