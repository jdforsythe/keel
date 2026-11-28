// @vitest-environment node
// k.privacy Server log: what the `[secret]` pass of a `diag` record reaches. A revealed secret of the action input is
// marked in each of the record's `frames` as in its message; a boolean secret is not marked, as `piiValues` gives no
// boolean; a `Secret` the request parses or makes after its input (a loader's parse, a minted token) is marked too. Each
// request marks only its own: an in-process peer's request and an overlapping request keep their own sets. Seed 1337.
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok } from "@keel/schema";
import { reveal, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { textRecords } from "./textRecords.ts";

const TOKEN = "tok-7f3a9c";
const ROOT = "/keel-scrub-root";

/** An `Error` whose stack has one app frame at `file` under the project root. */
const thrownAt = (message: string, file: string): Error => {
  const e = new Error(message);
  e.stack = `Error: ${message}\n    at run (${ROOT}/${file}:3:7)`;
  return e;
};

type Diag = { code: string; message: string; frames?: string[] };

async function send(
  input: ReturnType<typeof s.object>,
  run: (v: unknown) => Promise<never>,
  sent: unknown,
  load?: () => Promise<never>,
): Promise<{ diags: Diag[]; lines: string[] }> {
  const lines: string[] = [];
  const c = contract("app", { "app.a": { path: "/a" } });
  const routes = manifest(c, {
    "app.a": {
      ...(load === undefined ? {} : { loader: loader(c, "app.a", { output: s.object({}) }, load) }),
      component: () => document.createElement("main"),
      POST: action(c, "app.a", { input }, (v) => run(v)),
    },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
    artifacts: `${ROOT}/.keel`,
    log: { format: "json", write: (l) => lines.push(l) },
  });
  await app.fetch(
    new Request("http://localhost/a", {
      method: "POST",
      body: JSON.stringify(sent),
      headers: { "content-type": "application/json", accept: load === undefined ? "application/json" : "text/html" },
    }),
  );
  const diags: Diag[] = textRecords(lines)
    .map((l) => JSON.parse(l))
    .filter((d: Diag) => d.code === "keel.unexpected");
  return { diags, lines };
}

describe("[secret] in a diag frame", () => {
  it("marks a revealed input secret where it stands in a frame path, as in the message", async () => {
    const input = s.object({ key: s.secret(s.string()) });
    const { diags, lines } = await send(
      input,
      async (v) => {
        const key = input.parse(v);
        throw thrownAt(`key ${key.ok ? reveal(key.value.key) : ""}`, `modules/${TOKEN}/a.server.ts`);
      },
      { key: TOKEN },
    );
    expect(diags).toHaveLength(1);
    expect(diags[0]?.message).toBe("action app.a threw: Error: key [secret]");
    const form = lines.map((l): Diag => JSON.parse(l)).find((d) => d.frames !== undefined);
    expect(form?.message).toMatch(/^action app\.a threw: Error #[0-9a-f]{8} at modules\/\[secret\]\/a\.server\.ts:3$/);
    expect(form?.frames).toEqual(["modules/[secret]/a.server.ts:3:7"]);
    for (const l of lines) expect(l).not.toContain(TOKEN);
  });
});

describe("a boolean secret", () => {
  it("is not marked: true and false stand in every log, and piiValues gives no boolean either", async () => {
    const input = s.object({ flag: s.secret(s.boolean()) });
    const { diags } = await send(
      input,
      async (v) => {
        const got = input.parse(v);
        throw new Error(`flag ${got.ok ? String(reveal(got.value.flag)) : ""}`);
      },
      { flag: true },
    );
    expect(diags.map((d) => d.message)).toEqual(["action app.a threw: Error: flag true"]);
  });
});

describe("a secret made during the request", () => {
  const Key = s.secret(s.string());
  const input = s.object({ note: s.string() });

  it("a secret a loader parses after an await is marked in that loader's diag", async () => {
    const { diags } = await send(
      input,
      async () => {
        throw new Error("stop");
      },
      { note: "n" },
      async () => {
        await Promise.resolve();
        const key = Key.parse("api-key-91c2e7d40b");
        throw new Error(`upstream refused ${key.ok ? reveal(key.value) : ""}`);
      },
    );
    const loaderDiag = diags.find((d) => d.message.startsWith("loader app.a threw"));
    expect(loaderDiag?.message).toBe("loader app.a threw: Error: upstream refused [secret]");
  });

  it("a token the action makes after an await is marked", async () => {
    const { diags } = await send(
      input,
      async () => {
        await Promise.resolve();
        const token = Key.parse("keelsim_0a1b2c3d4e5f6071_9f8e7d6c5b4a39281706f5e4d3c2b1a0");
        throw new Error(`mailer down; token ${token.ok ? reveal(token.value) : ""}`);
      },
      { note: "n" },
    );
    expect(diags.map((d) => d.message)).toEqual(["action app.a threw: Error: mailer down; token [secret]"]);
  });
});

const Secretly = s.secret(s.string());
const Note = s.object({ note: s.string() });
const madeText = (text: string): string => {
  const made = Secretly.parse(text);
  return made.ok ? reveal(made.value) : "";
};
async function appOf(
  run: (input: { note: string }) => Promise<never>,
): Promise<{ app: Awaited<ReturnType<typeof createApp>>; lines: string[] }> {
  const lines: string[] = [];
  const c = contract("app", { "app.a": { path: "/a" } });
  const routes = manifest(c, {
    "app.a": {
      component: () => document.createElement("main"),
      POST: action(c, "app.a", { input: Note }, (v) => run(v)),
    },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
    log: { format: "json", write: (l) => lines.push(l) },
  });
  return { app, lines };
}
const postNote = (note: string): Request =>
  new Request("http://localhost/a", {
    method: "POST",
    body: JSON.stringify({ note }),
    headers: { "content-type": "application/json", accept: "application/json" },
  });
const messages = (lines: readonly string[]): string[] =>
  textRecords(lines)
    .map((l): Diag => JSON.parse(l))
    .filter((d) => d.code === "keel.unexpected")
    .map((d) => d.message);

describe("whose secret", () => {
  const PEER = "peer-secret-5d1e9a";
  const CALLER = "caller-secret-b37c0f";

  it("an in-process peer's secret marks the peer's line and not the caller's; the caller's marks only its own", async () => {
    const peer = await appOf(async ({ note }) => {
      await Promise.resolve();
      throw new Error(`peer ${madeText(PEER)} got ${note}`);
    });
    const caller = await appOf(async () => {
      const mine = madeText(CALLER);
      await (await peer.app.fetch(postNote(mine))).text();
      throw new Error(`caller ${mine} saw ${PEER}`);
    });
    await (await caller.app.fetch(postNote("n"))).text();
    expect(messages(peer.lines)).toEqual([`action app.a threw: Error: peer [secret] got ${CALLER}`]);
    expect(messages(caller.lines)).toEqual([`action app.a threw: Error: caller [secret] saw ${PEER}`]);
  });

  it("two overlapping requests do not mark each other's lines", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let both: () => void = () => undefined;
    const arrived = new Promise<void>((r) => {
      both = r;
    });
    let count = 0;
    const t = await appOf(async ({ note }) => {
      const mine = madeText(note);
      count++;
      if (count === 2) both();
      await gate;
      throw new Error(`have ${mine}; both ${PEER} ${CALLER}`);
    });
    const one = t.app.fetch(postNote(PEER));
    const two = t.app.fetch(postNote(CALLER));
    await arrived;
    release();
    await Promise.all([(await one).text(), (await two).text()]);
    expect(messages(t.lines).sort()).toEqual(
      [
        `action app.a threw: Error: have [secret]; both [secret] ${CALLER}`,
        `action app.a threw: Error: have [secret]; both ${PEER} [secret]`,
      ].sort(),
    );
  });
});

describe("a live stream", () => {
  it("marks a secret its loader makes after the response started, on the stream's later diag", async () => {
    const LATE = "late-secret-4e8a2c";
    const lines: string[] = [];
    const c = contract("api", { "api.live": { method: "GET", path: "/api/live", output: s.object({}), events: true } });
    const live = loader(c, "api.live", {}, async function* () {
      yield ok({});
      await Promise.resolve();
      throw new Error(`late ${madeText(LATE)}`);
    });
    const routes = manifest(c, { "api.live": { loader: live } });
    const app = await createApp({
      topology: topology({ web: { modules: ["api"], adapter: "node" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: 1337 }),
      mode: "dev",
      log: { format: "json", write: (l) => lines.push(l) },
    });
    const res = await app.fetch(new Request("http://localhost/api/live", { headers: { accept: "text/event-stream" } }));
    expect(await res.text()).not.toContain(LATE);
    expect(messages(lines)).toEqual(["loader api.live threw: Error: late [secret]"]);
    for (const l of lines) expect(l).not.toContain(LATE);
  });
});
