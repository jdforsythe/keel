// @vitest-environment happy-dom
// k.privacy Server log: every thrown text the server sends on (a response body, a stream line, a dev message, a log
// line) goes through the request's scrub first. An output encode that throws in a loader or a live loader, a component
// or errorElement that throws while rendering each answer with the revealed secret
// the request made replaced by `[secret]`, in dev and production. Seed 1337.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { type KeelError, ok, reveal, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const T = "tok-9a8b7c6d5e4f3a2b";
const Secretly = s.secret(s.string());
const made = (): string => {
  const m = Secretly.parse(T);
  return m.ok ? reveal(m.value) : "";
};
const modes = ["dev", "production"] as const;

/** A value whose field getter passes its first read (`output.parse`) and throws naming the secret after, so `encode` throws. */
const encodeThrows = (): { n: string } => {
  const t = made();
  let reads = 0;
  return {
    get n(): string {
      reads++;
      if (reads > 1) throw new Error(`enc ${t}`);
      return "x";
    },
  };
};
const Out = s.object({ n: s.string() });

const c = contract("app", {
  "app.l": { method: "GET", path: "/api/l", output: Out },
  "app.v": { method: "GET", path: "/api/v", output: Out, events: true },
  "app.c": { path: "/c" },
  "app.e": { path: "/e" },
  "app.ee": { path: "/ee" },
});
const encodeLoad = loader(c, "app.l", {}, async () => ok(encodeThrows()));
const encodeLive = loader(c, "app.v", {}, async function* () {
  yield ok(encodeThrows());
});

async function run(mode: "dev" | "production", url: string, accept: string) {
  const lines: string[] = [];
  const routes = manifest(c, {
    "app.l": { loader: encodeLoad },
    "app.v": { loader: encodeLive },
    "app.c": {
      component: () => {
        throw new Error(`render ${made()}`);
      },
    },
    "app.e": {
      component: () => {
        throw new Error(`render ${made()}`);
      },
      errorElement: (p: { readonly error: KeelError<string, unknown> }) => {
        const el = document.createElement("section");
        el.textContent = `${p.error.message} ${JSON.stringify(p.error.data)}`;
        return el;
      },
    },
    "app.ee": {
      component: () => {
        throw new Error("plain");
      },
      errorElement: () => {
        throw new Error(`boundary ${made()}`);
      },
    },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode,
    log: { format: "json", write: (l) => void lines.push(l) },
  });
  const res = await app.fetch(new Request(`http://localhost${url}`, { headers: { accept } }));
  const body = await res.text();
  await app.close();
  return { body, lines, status: res.status };
}

describe("thrown text the server sends on", () => {
  for (const mode of modes) {
    it(`an encode throw in a loader is scrubbed in the JSON result, ${mode}`, async () => {
      const { body, lines } = await run(mode, "/api/l", "application/json");
      expect(body).not.toContain(T);
      expect(lines.join("\n")).not.toContain(T);
      if (mode === "dev") expect(body).toContain("[secret]");
    });

    it(`an encode throw in a live loader is scrubbed in its stream line, ${mode}`, async () => {
      const { body, lines } = await run(mode, "/api/v", "text/event-stream");
      expect(body).toContain("keel.unexpected");
      expect(body).not.toContain(T);
      expect(lines.join("\n")).not.toContain(T);
      if (mode === "dev") expect(body).toContain("[secret]");
    });

    for (const url of ["/c", "/e", "/ee"])
      it(`a render throw at ${url} is scrubbed in the document and its dev message, ${mode}`, async () => {
        const { body, lines, status } = await run(mode, url, "text/html");
        expect(status).toBe(500);
        expect(body).not.toContain(T);
        expect(lines.join("\n")).not.toContain(T);
      });
  }
});
