import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { CODE_FILE } from "./CODE_FILE.ts";
import type { DevServer } from "./DevServer.ts";
import type { Diag } from "./Diag.ts";
import { errorText } from "./errorText.ts";
import { makeDiag } from "./makeDiag.ts";

/**
 * Binary only: `keel dev`'s refresh of the views it does not compile (k.derived Refresh): once at the start, then after
 * each change the dev server's watcher sees to a file the last derivation read (`devViews`' `files`, compared by real
 * path, a lone contract file among them) or to the code file paths (a code file of the project added or removed; any
 * code file change while the last derivation failed and read none). Runs never overlap: a change during one ends its
 * evaluation (an abort signal) and runs one more after it. An event for a file whose bytes are those of its last event
 * (the watcher reports one write more than once) is no change. Each new input outside the root is watched. The root project's `routes.json` entries go to the
 * Vite plugin after each refresh (`derivedRoutes`), so one evaluation per change serves both. `print` gets its W1018
 * records, and an E1049 when a refresh itself fails.
 */
export function devRefresh(cwd: string, server: DevServer, print: (diags: readonly Diag[]) => void): void {
  const root = realpathSync(cwd);
  const real = (file: string): string => {
    try {
      return realpathSync(file);
    } catch {
      return join(root, relative(cwd, file));
    }
  };
  let files = new Set<string>();
  let running = false;
  let again = false;
  let current: AbortController | undefined;
  /** Each changed file's bytes at its last event, by real path, as a digest (absent: the file is gone). */
  const seen = new Map<string, string>();
  const bytesOf = (file: string): string => {
    try {
      return createHash("sha256").update(readFileSync(file)).digest("hex");
    } catch {
      return "";
    }
  };
  const run = async (): Promise<void> => {
    if (running) {
      // The running evaluation read the tree before this change: it is ended, and the next starts.
      again = true;
      current?.abort();
      return;
    }
    running = true;
    try {
      do {
        again = false;
        const { devViews } = await import("@keel/cli/derive");
        const controller = new AbortController();
        current = controller;
        let r: Awaited<ReturnType<typeof devViews>>;
        try {
          r = await devViews(cwd, controller.signal);
        } catch (e) {
          if (controller.signal.aborted) continue;
          throw e;
        }
        files = new Set(r.files.map(real));
        server.watch([...files].filter((f) => relative(root, f).startsWith("..")));
        if (r.routes !== null) server.derivedRoutes(r.routes);
        if (r.diags.length > 0) print(r.diags);
      } while (again);
    } catch (e) {
      print([makeDiag("E1049", errorText(e), { see: "k.compiler" })]);
    } finally {
      running = false;
    }
  };
  server.onChange((event, file) => {
    const rel = relative(cwd, file).split(sep).join("/");
    const own = !rel.startsWith("..") && !rel.split("/").some((s) => s === "node_modules" || s === ".keel");
    const code = own && CODE_FILE.test(rel);
    if (!(code && (event !== "change" || files.size === 0)) && !files.has(real(file))) return;
    const digest = bytesOf(file);
    if (event === "change" && seen.get(real(file)) === digest) return;
    seen.set(real(file), digest);
    void run();
  });
  void run();
}
