import { request } from "node:http";

/** Whether `origin` gives any HTTP answer to `GET /` (k.e2e serve readiness). */
export function answersAt(origin: string): Promise<boolean> {
  return new Promise((done) => {
    const req = request(new URL("/", origin), { method: "GET", headers: { accept: "text/html" } }, (res) => {
      res.resume();
      done(true);
    });
    req.on("error", () => done(false));
    req.setTimeout(5_000, () => {
      req.destroy();
      done(false);
    });
    req.end();
  });
}
