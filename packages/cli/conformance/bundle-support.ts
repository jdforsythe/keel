// Fixtures for the k.bundle conformance files (not a test file). Seed 1337 for every property.
// Each fixture is the node fixture of boundary-support.ts plus a few files; `vite build` runs with `KEEL_DEPLOYABLE`, as `keel build` runs it per deployable.
import { type Tree, cleanup, materialize, nodeTree, withFiles } from "./boundary-support.ts";

export const CANARY_NOTES = "K_BNOTES_4b1c9e7a02d85f36c1a9";
export const CANARY_KEYS = "K_BKEYS_9d3e5a7c1b0f4286e5a1";
export const CANARY_COPY = "K_BCOPY_6e2a8c4f0b7d1359a2c8";
export const ALIVE = "K_BALIVE_0c7e3a9d5b1f4682a7d3";

export const PAGE = nodeTree("node")["modules/a/Page.tsx"] ?? "";
export const ROUTES = nodeTree("node")["modules/a/routes.ts"] ?? "";

/** `Page.tsx` with `imports` first and `stmt` run at its top level. No type reference: `import.meta.env` is typed by Keel's declaration alone (k.boundary Ambient types). */
export const page = (imports: string, stmt: string): string =>
  `${imports}\n${PAGE}\nReflect.set(globalThis, 'extra', ${stmt})\n`;

export const STEPS = /server code in browser build: ([a-z -]+): (.+)$/;
export const reasonOf = (line: string): string => STEPS.exec(line)?.[1] ?? "";
export const chainOf = (line: string): string[] => (STEPS.exec(line)?.[2] ?? "").split(" -> ");
/** A chain step without a trailing `?worker` or `?sharedworker`: the spec names the worker's file, not how it was named. */
export const bare = (step: string): string => step.replace(/\?(shared)?worker$/, "");

/** Builds `files` in a fresh project, runs `fn`, removes it. */
export async function inProject<T>(files: Tree, fn: (dir: string) => T | Promise<T>): Promise<T> {
  const dir = materialize(files);
  try {
    return await fn(dir);
  } finally {
    cleanup(dir);
  }
}

export const nodeWith = (files: Tree): Tree => withFiles(nodeTree("node"), files);
