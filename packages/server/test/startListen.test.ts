// `start` prints one line when it listens and one coded line, then exits 1, when the port is taken.
import fs from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { start } from "../src/start.ts";

const options = {
  topology: { web: { modules: [], adapter: "node" } },
  deployable: "web",
  routes: [],
  runners: {},
  dir: ".",
} as const;
const built = (): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "keel-start-"));
  fs.mkdirSync(path.join(d, ".vite"), { recursive: true });
  fs.mkdirSync(path.join(d, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(d, ".vite/manifest.json"),
    JSON.stringify({ e: { file: "assets/entry-Ab12Cd34.js", isEntry: true } }),
  );
  fs.writeFileSync(path.join(d, "assets/entry-Ab12Cd34.js"), "resume()");
  return d;
};
const SECRET = "s".repeat(32);

const realExit = Reflect.get(process, "exit");
const exits: unknown[] = [];
const stubExit = (): void => {
  exits.length = 0;
  Reflect.set(process, "exit", (code: unknown) => {
    exits.push(code);
  });
};
afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.set(process, "exit", realExit);
});

describe("start output", () => {
  it("prints one listening line with the port, with or without KEEL_ORIGIN", async () => {
    for (const origin of [undefined, "https://app.example"]) {
      vi.stubEnv("PORT", "0");
      vi.stubEnv("KEEL_SECRET", SECRET);
      if (origin !== undefined) vi.stubEnv("KEEL_ORIGIN", origin);
      const out: string[] = [];
      const write = vi.spyOn(process.stdout, "write").mockImplementation((t) => {
        out.push(String(t));
        return true;
      });
      stubExit();
      const once = vi.spyOn(process, "once");
      await start({ ...options, dir: built() });
      await vi.waitFor(() => expect(out.some((l) => l.startsWith("ok listening on port "))).toBe(true));
      write.mockRestore();
      expect(out.filter((l) => l.startsWith("ok listening"))).toHaveLength(1);
      const stop = once.mock.calls.find((c) => c[0] === "SIGTERM")?.[1];
      once.mockRestore();
      if (typeof stop === "function") stop();
      await vi.waitFor(() => expect(exits).toEqual([0]));
    }
  });

  it("a busy port is one E1560 line and exit 1", async () => {
    const busy = createServer();
    await new Promise<void>((r) => busy.listen(0, r));
    const addr = busy.address();
    const port = typeof addr === "object" && addr !== null ? addr.port : 0;
    vi.stubEnv("PORT", String(port));
    vi.stubEnv("KEEL_SECRET", SECRET);
    vi.stubEnv("KEEL_ORIGIN", "https://app.example");
    const out: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((t) => {
      out.push(String(t));
      return true;
    });
    stubExit();
    await start({ ...options, dir: built() });
    await vi.waitFor(() => expect(exits).toEqual([1]));
    write.mockRestore();
    busy.close();
    expect(out).toEqual([`E1560 PORT ${port} fails to bind (EADDRINUSE); free it or set another PORT\n`]);
  });
});
