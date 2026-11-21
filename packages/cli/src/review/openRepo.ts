import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import type { Change } from "./Change.ts";
import type { GitRepo } from "./GitRepo.ts";

const MAX = 1 << 30;

/** Run git in `cwd`; the exit status and stdout bytes. No pager, external diff or text conversion; no prompt. */
function run(cwd: string, args: readonly string[], input?: string): { status: number; out: Buffer } {
  const r = spawnSync("git", ["-c", "core.quotepath=off", "--no-pager", ...args], {
    cwd,
    maxBuffer: MAX,
    ...(input === undefined ? {} : { input }),
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
  });
  return { status: r.status ?? 1, out: r.stdout ?? Buffer.alloc(0) };
}

const fields = (b: Buffer): string[] =>
  b
    .toString("utf8")
    .split("\0")
    .filter((s) => s !== "");

/**
 * Binary only: the git repository holding `cwd`, or null outside one (k.review Command). It reads objects and the
 * index only: no fetch, no write.
 */
export function openRepo(cwd: string): GitRepo | null {
  const top = run(cwd, ["rev-parse", "--show-toplevel"]);
  if (top.status !== 0) return null;
  const root = realpathSync(top.out.toString("utf8").trim());
  return {
    root,
    commit: (rev) => {
      if (rev.startsWith("-")) return null;
      const r = run(root, ["rev-parse", "--verify", "--quiet", "--end-of-options", `${rev}^{commit}`]);
      const id = r.out.toString("utf8").trim();
      return r.status === 0 && /^[0-9a-f]{40,64}$/.test(id) ? id : null;
    },
    tree: (commit) => {
      const out = new Map<string, string>();
      for (const entry of fields(run(root, ["ls-tree", "-r", "-z", "--full-tree", commit]).out)) {
        const tab = entry.indexOf("\t");
        const [, type, id] = entry.slice(0, tab).split(" ");
        if (type === "blob" && id !== undefined) out.set(entry.slice(tab + 1), id);
      }
      return out;
    },
    blobs: (ids) => {
      const out = new Map<string, string>();
      const want = [...new Set(ids)];
      if (want.length === 0) return out;
      const buf = run(root, ["cat-file", "--batch"], `${want.join("\n")}\n`).out;
      let at = 0;
      while (at < buf.length) {
        const nl = buf.indexOf(10, at);
        if (nl < 0) break;
        const [id = "", type = "", size = "0"] = buf.subarray(at, nl).toString("utf8").split(" ");
        if (type === "missing") {
          at = nl + 1;
          continue;
        }
        const n = Number(size);
        out.set(id, buf.subarray(nl + 1, nl + 1 + n).toString("utf8"));
        at = nl + 1 + n + 1;
      }
      return out;
    },
    diff: (base, head) => {
      const f = fields(
        run(root, ["diff", "-z", "--name-status", "-M", "--no-ext-diff", "--no-textconv", base, head]).out,
      );
      const out: Change[] = [];
      for (let i = 0; i < f.length; ) {
        const st = f[i] ?? "";
        const kind = st.charAt(0);
        if (kind === "R" || kind === "C") {
          const from = f[i + 1] ?? "";
          const path = f[i + 2] ?? "";
          out.push(kind === "R" ? { status: "R", path, from, same: st === "R100" } : { status: "A", path });
          i += 3;
        } else {
          const path = f[i + 1] ?? "";
          if (kind === "A" || kind === "D") out.push(kind === "A" ? { status: "A", path } : { status: "D", path, from: path });
          else out.push({ status: "M", path, from: path });
          i += 2;
        }
      }
      return out;
    },
    files: () => fields(run(root, ["ls-files", "-z", "-c", "-o", "--exclude-standard", "--full-name"]).out).sort(),
  };
}
