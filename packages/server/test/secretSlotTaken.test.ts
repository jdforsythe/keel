// @vitest-environment node
// k.privacy Server log: the server's listener in the `onSecret` slot (`@keel/schema/internal`) is taken again at the
// start of each request and each runner's `run`; a request or run that finds, when its texts are scrubbed, that the
// slot was cleared or replaced while it ran cannot know its secrets, so each of its texts is one `[secret]`. Seed 1337.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { type ObjectSchema, reveal, s } from "@keel/schema";
import { onSecret } from "@keel/schema/internal";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { keepRunning } from "../src/internal/keepRunning.ts";
import { redacted } from "../src/internal/redacted.ts";
import { thrownText } from "../src/internal/thrownText.ts";
import { textRecords } from "./textRecords.ts";

const SEED = 1337;
const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);

async function actionApp<I>(input: ObjectSchema<I>, run: (v: I) => Promise<never>) {
  const lines: string[] = [];
  const c = contract("app", { "app.a": { path: "/a" } });
  const save = action(c, "app.a", { input }, (v) => run(v));
  const routes = manifest(c, { "app.a": { component: () => document.createElement("main"), POST: save } });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "dev",
    artifacts: "/keel-slot-root/.keel",
    log: { format: "json", write: (l) => void lines.push(l) },
  });
  const post = (k: string) =>
    app.fetch(
      new Request("http://localhost/a", {
        method: "POST",
        body: JSON.stringify({ k }),
        headers: { "content-type": "application/json", accept: "application/json" },
      }),
    );
  const diags = (): unknown[] =>
    textRecords(lines)
      .map((l): unknown => JSON.parse(l))
      .filter((d) => field(d, "kind") === "diag");
  return { post, lines, diags };
}

const input = s.object({ k: s.secret(s.string()) });

describe("the onSecret slot taken while an app runs", () => {
  it("a slot cleared between two requests is taken again by the next request", async () => {
    const t = await actionApp(input, async (v) => {
      throw new Error(`k ${reveal(v.k)}`);
    });
    const off = onSecret(() => undefined);
    off();
    await t.post("cleared-between-111");
    expect(t.diags()).toHaveLength(1);
    expect(String(field(t.diags()[0], "message"))).toContain("k [secret]");
    for (const l of t.lines) expect(l).not.toContain("cleared-between-111");
  });

  it("a slot replaced between two requests is taken again by the next request", async () => {
    const t = await actionApp(input, async (v) => {
      throw new Error(`k ${reveal(v.k)}`);
    });
    onSecret(() => undefined);
    await t.post("replaced-between-222");
    expect(String(field(t.diags()[0], "message"))).toContain("k [secret]");
    for (const l of t.lines) expect(l).not.toContain("replaced-between-222");
  });

  it("a slot replaced while a request runs leaves each of that request's texts one [secret]", async () => {
    const t = await actionApp(s.object({ k: s.string() }), async (v) => {
      onSecret(() => undefined);
      const later = s.secret(s.string()).parse(`${v.k}-x`);
      throw new Error(`k ${later.ok ? reveal(later.value) : ""}`);
    });
    await t.post("replaced-during-333");
    const diags = t.diags();
    expect(diags).toHaveLength(1);
    expect(String(field(diags[0], "message"))).toContain("[secret]");
    for (const l of t.lines) expect(l).not.toContain("replaced-during-333-x");
  });

  it("a slot cleared while a request runs, with no secret yet, leaves that request's texts one [secret]", async () => {
    const t = await actionApp(s.object({ k: s.string() }), async (v) => {
      onSecret(() => undefined)();
      const later = s.secret(s.string()).parse(`${v.k}-x`);
      throw new Error(`k ${later.ok ? reveal(later.value) : ""}`);
    });
    await t.post("cleared-during-444");
    expect(String(field(t.diags()[0], "message"))).toContain("[secret]");
    for (const l of t.lines) expect(l).not.toContain("cleared-during-444-x");
  });

  it("an overlapping request that ends first and takes the slot back leaves the other one marked whole", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const t = await actionApp(input, async (v) => {
      const k = reveal(v.k);
      if (k.startsWith("slow")) {
        onSecret(() => undefined);
        await gate;
        const late = s.secret(s.string()).parse(`${k}-late`);
        throw new Error(`k ${late.ok ? reveal(late.value) : ""}`);
      }
      throw new Error(`k ${k}`);
    });
    const slow = t.post("slow-555");
    await t.post("fast-666");
    release();
    await slow;
    for (const l of t.lines) {
      expect(l).not.toContain("slow-555-late");
      expect(l).not.toContain("fast-666");
    }
  });
});

describe("the onSecret slot taken while a runner's run runs", () => {
  it("leaves each text scrubbed with that run's set one [secret]", async () => {
    const seen: string[] = [];
    const again = new AbortController();
    await keepRunning(
      {
        run: async () => {
          onSecret(() => undefined)();
          const late = s.secret(s.string()).parse("runner-late-888");
          throw new Error(`k ${late.ok ? reveal(late.value) : ""}`);
        },
      },
      createCtx({ mode: "sim", seed: SEED }),
      again.signal,
      (thrown, _frames, secrets) => {
        seen.push(redacted(thrownText(thrown), { secrets, pii: new Set() }));
        again.abort();
      },
      () => [],
    );
    expect(seen).toEqual(["[secret]"]);
  });
});
