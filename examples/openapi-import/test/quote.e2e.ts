// The built server's page shows what a stub of the OpenAPI document's server answered to the generated client: the
// document's `http://localhost:4417` answers the one request the server's render makes, `GET /quotes/q1`, and the page
// in a browser names its text and author. No page or console error is raised (an unread one fails the test).
import { createServer } from "node:http";
import { serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";

it("the page shows the quote the document's server answered to the generated client", async () => {
  const seen: string[] = [];
  const stub = createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "q1", text: "Served by the stub.", author: "smoke" }));
  });
  await new Promise<void>((done, failed) => {
    stub.once("error", failed);
    stub.listen(4417, "127.0.0.1", () => done());
  });
  try {
    const app = await serve();
    // The document as the server renders it: one request to the stub, its text in the HTML (serve's own readiness
    // GET / made one before).
    seen.length = 0;
    const res = await app.fetch("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Served by the stub.");
    expect(seen).toEqual(["GET /quotes/q1"]);
    // The same page in a browser.
    const page = await app.open("/");
    expect((await page.find("app.home.quote")).text).toBe("Served by the stub.");
    expect((await page.find("app.home.author")).text).toBe("smoke");
  } finally {
    stub.closeAllConnections();
    await new Promise((done) => stub.close(done));
  }
});
