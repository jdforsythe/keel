// The built `web` greets the user its identity source names, through the built `api` at `KEEL_PEER_API`, which `serve`
// wires; `api` refuses a user header it did not sign; the compose file names `api` as `web`'s peer.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";

it("web greets the user through its api peer, api refuses a forged user header, compose names the peer", async () => {
  const app = await serve();
  const home = async (headers: Record<string, string>): Promise<string> =>
    (await app.fetch("/", { deployable: "web", headers: { accept: "text/html", ...headers } })).text();

  expect(await home({ "x-forwarded-user": "Ada" })).toContain("Hello, Ada");
  expect(await home({})).toContain("api.status");

  const forged = await app.fetch("/api/hello", {
    deployable: "api",
    headers: { accept: "application/json", "x-keel-user": "Ada" },
  });
  expect(forged.status).toBe(403);

  const compose = await readFile(join(import.meta.dirname, "..", "deploy", "compose.yaml"), "utf8");
  expect(compose).toContain("KEEL_PEER_API: http://api:8080");
});
