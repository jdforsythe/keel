// @vitest-environment node
// k.privacy Server log on a live stream: the request's secret set is the stream's for as long as it is open, so each
// `Secret` its loader makes on a tick joins the set and stays until the stream ends. Once the values' written forms pass
// 2,000,000 characters the set takes no more values, and the thrown text in the stream's `keel.unexpected` diag is one
// `[secret]` mark. Seed 1337.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { ok, reveal, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { requestSecrets } from "../src/internal/requestSecrets.ts";

const Secretly = s.secret(s.string());

/** The `i`th distinct secret of `width` characters, made and revealed inside the running request. */
const madeText = (i: number, width: number): string => {
  const made = Secretly.parse(`tick${i}-`.padEnd(width, "x"));
  return made.ok ? reveal(made.value) : "";
};

/** Streams `ticks` yields, each making a fresh secret, then throws naming the last one; returns sizes and log. */
async function stream(ticks: number, width: number): Promise<{ sizes: number[]; messages: string[] }> {
  const sizes: number[] = [];
  const lines: string[] = [];
  const live = loader({ output: s.object({}) }, async function* () {
    let last = "";
    for (let i = 0; i < ticks; i++) {
      last = madeText(i, width);
      sizes.push(requestSecrets.getStore()?.size ?? -1);
      yield ok({});
    }
    throw new Error(`plain words; last ${last}`);
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["api"], adapter: "node" } }),
    routes: manifest({ "api.live": { api: true, path: "/api/live", loader: live } }),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
    log: { format: "json", write: (l) => lines.push(l) },
  });
  const res = await app.fetch(new Request("http://localhost/api/live", { headers: { accept: "text/event-stream" } }));
  await res.text();
  const messages = lines
    .map((l): { code: string; message: string } => JSON.parse(l))
    .filter((d) => d.code === "keel.unexpected")
    .map((d) => d.message);
  return { sizes, messages };
}

describe("a live stream making a fresh secret per tick", () => {
  it("holds every secret it made until it ends: the set grows by one per tick", async () => {
    const { sizes, messages } = await stream(500, 40);
    // The empty string joins with the first secret, then one value per tick.
    expect(sizes[0]).toBe(2);
    expect(sizes[499]).toBe(501);
    expect(sizes.every((n, i) => n === i + 2)).toBe(true);
    expect(messages).toEqual(["loader api.live threw: Error: plain words; last [secret]"]);
  });

  it("past the scrub's cap the set stops growing and the thrown text in its diag is one [secret] mark", async () => {
    // Each value is 1,000 characters as is and about 1,333 as base64: the forms pass the cap on the 857th tick.
    const { sizes, messages } = await stream(1000, 1000);
    // One value per tick until the 857th, whose forms take the set past the cap; then 858 values on every later tick.
    expect(sizes.slice(0, 857).every((n, i) => n === i + 2)).toBe(true);
    expect(sizes.slice(856).every((n) => n === 858)).toBe(true);
    expect(messages).toEqual(["loader api.live threw: [secret]"]);
  });
});
