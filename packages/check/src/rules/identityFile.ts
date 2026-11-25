import { assetsProblem } from "@keel/compiler/hosting/assetsProblem";
import { identitySource } from "@keel/compiler/hosting/identitySource";
import { mountSource } from "@keel/compiler/hosting/mountSource";
import { findingAt } from "../internal/findingAt.ts";
import { str } from "../internal/str.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1579 (k.user Rules): a project's `identity.server.ts` (beside `topology.ts`, not under `modules/` or `packages/`)
 * without a default `identity(...)` export, or whose `handle.path` is not of lowercase `/` segments, or is at or under
 * `/assets` (`identitySource`; for `identity.ts`'s `.path`, the path the `identity.ts` beside it mounts). A route at or
 * under `handle.path` is `keel check`'s project pass. At the file's first line. No fix.
 */
export const identityFile: RuleDef = {
  code: "E1579",
  message: (f) => str(f.data, "m"),
  see: "k.user",
  check: ({ file, project }) => {
    if (!/(^|\/)identity\.server\.ts$/.test(file.path) || /(^|\/)(modules|packages)\//.test(file.path)) return [];
    const read = identitySource(file.source);
    const beside = `${file.path.slice(0, -"identity.server.ts".length)}identity.ts`;
    const mount = read.mounted ? project.find((f) => f.path === beside)?.source : undefined;
    const mounted = mount === undefined ? undefined : mountSource(mount).path;
    const m = read.problem ?? (mounted === undefined ? undefined : assetsProblem(mounted));
    return m === undefined ? [] : [findingAt(file, 0, { m })];
  },
};
