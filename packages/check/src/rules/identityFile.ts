import { identitySource } from "@keel/compiler/hosting/identitySource";
import { findingAt } from "../internal/findingAt.ts";
import { str } from "../internal/str.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1579 (k.user Rules): a project's `identity.server.ts` (beside `topology.ts`, not under `modules/` or `packages/`)
 * without a default `identity(...)` export, or whose `handle.path` is not of lowercase `/` segments (`identitySource`).
 * A route at or under `handle.path` is `keel check`'s project pass. No fix.
 */
export const identityFile: RuleDef = {
  code: "E1579",
  message: (f) => str(f.data, "m"),
  see: "k.user",
  check: ({ file }) => {
    if (!/(^|\/)identity\.server\.ts$/.test(file.path) || /(^|\/)(modules|packages)\//.test(file.path)) return [];
    const m = identitySource(file.source).problem;
    return m === undefined ? [] : [findingAt(file, 0, { m })];
  },
};
