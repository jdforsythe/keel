// @vitest-environment node
// k.privacy Server log: what the `[secret]` pass of a `diag` record reaches. A revealed secret of the action input is
// marked in each of the record's `frames` as in its message; a boolean secret is not marked, as `piiValues` gives no
// boolean; a `Secret` the request parses or makes after its input (a loader's parse, a minted token) is in no scrub set.
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { reveal, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

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
  const routes = manifest({
    "app.a": {
      path: "/a",
      ...(load === undefined ? {} : { loader: loader({ output: s.object({}) }, load) }),
      component: () => document.createElement("main"),
    },
  });
  routes.actions({ "app.a": { POST: action({ input }, (v) => run(v)) } });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
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
  const diags: Diag[] = lines.map((l) => JSON.parse(l)).filter((d: Diag) => d.code === "keel.unexpected");
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
    expect(diags[0]?.frames).toEqual(["modules/[secret]/a.server.ts:3:7"]);
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

  it.fails("a secret a loader parses is marked in that loader's diag (no kernel record of it yet)", async () => {
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

  it.fails("a token the action makes after an await is marked (no kernel record of it yet)", async () => {
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
