// A deliberately broken Recipe box for proving the scorer fails: one static page for every path, no ids, no policy
// headers, a version-naming server header, an image without alt text and a cookie without flags. `PORT` sets the port.
import { createServer } from "node:http";

const page = `<!doctype html><html><head><title>app</title></head><body>
<img src="/logo.png"><div onclick="1">Recipes</div><input type="text"></body></html>`;

createServer((req, res) => {
  res.writeHead(200, {
    "content-type": "text/html",
    "x-powered-by": "Stub 1.0",
    server: "stub/1.0",
    "set-cookie": "sid=1",
    "access-control-allow-origin": "*",
  });
  res.end(page);
}).listen(Number(process.env.PORT ?? 0), "127.0.0.1", () => process.stdout.write("listening\n"));
