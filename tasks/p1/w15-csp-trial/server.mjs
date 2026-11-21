import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
export const csp = (n) =>
  [
    "default-src 'none'",
    `script-src 'nonce-${n}' 'strict-dynamic'`,
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "require-trusted-types-for 'script'",
    "trusted-types keel",
  ].join("; ");
let ssr = "";
export function start(port = 0) {
  return new Promise((res) => {
    const s = http.createServer((req, rs) => {
      const u = new URL(req.url, "http://x");
      if (u.pathname.startsWith("/p/")) {
        const lib = u.pathname.slice(3);
        const n = crypto.randomBytes(16).toString("base64");
        const css = lib === "uplot" ? '<link rel="stylesheet" href="/uPlot.min.css">' : "";
        rs.writeHead(
          200,
          u.searchParams.has("nocsp")
            ? { "content-type": "text/html" }
            : { "content-type": "text/html", "content-security-policy": csp(n) },
        );
        rs.end(`<!doctype html><html><head><meta charset=utf-8>${css}</head><body><div id="root"></div><script type="module" nonce="${n}">
window.__keelPolicy=trustedTypes.createPolicy('keel',{createHTML:s=>s});
window.__res={};
try{ const m=await import('/b/${lib}.js'); window.__feats=m.features; window.__ready=true; }catch(e){ window.__res.importError=String(e); window.__ready=true; }
</script></body></html>`);
        return;
      }
      if (u.pathname === "/ssr.svg") {
        if (req.method === "PUT") {
          let b = "";
          req.on("data", (d) => (b += d));
          req.on("end", () => {
            ssr = b;
            rs.end("ok");
          });
          return;
        }
        rs.writeHead(200, { "content-type": "image/svg+xml" });
        rs.end(ssr);
        return;
      }
      const f = u.pathname.startsWith("/b/")
        ? path.join(dir, "dist", u.pathname.slice(3))
        : u.pathname === "/uPlot.min.css"
          ? path.join(dir, "node_modules/uplot/dist/uPlot.min.css")
          : null;
      if (f && fs.existsSync(f)) {
        rs.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : "text/javascript" });
        rs.end(fs.readFileSync(f));
        return;
      }
      rs.writeHead(404);
      rs.end();
    });
    s.listen(port, "127.0.0.1", () => res(s));
  });
}
