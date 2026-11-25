import type { Origins } from "@keel/compiler";
import { declaredFor } from "@keel/compiler/hosting/declaredFor";
import { urlOrigin } from "@keel/compiler/hosting/urlOrigin";
import type { SourceFile } from "../types/SourceFile.ts";
import { dirPrograms } from "./dirPrograms.ts";
import { reachResolve } from "./reachResolve.ts";
import { topologyFor } from "./topologyFor.ts";

type Declared = ReturnType<typeof declaredFor>;

const reads = new WeakMap<readonly SourceFile[], Map<string, Declared>>();

/**
 * Whether the origin of URL text `url` (`urlOrigin`, `whole` when it is a whole literal) is declared under `directive`
 * (k.origins Rules) on each deployable that serves `path` (`declaredFor` over the files of its project's
 * `topology.ts` directory, each specifier followed by `reachResolve`, read once per project). False without a known origin, a directive or a `topology.ts`.
 */
export function isDeclaredUrl(
  path: string,
  project: readonly SourceFile[],
  directive: keyof Origins | undefined,
  url: string,
  whole: boolean,
): boolean {
  const top = topologyFor(path, project);
  const origin = urlOrigin(url, whole);
  if (top === undefined || directive === undefined || origin === undefined) return false;
  const byDir = reads.get(project) ?? new Map<string, Declared>();
  reads.set(project, byDir);
  const source = project.find((f) => f.path === `${top.dir}topology.ts`)?.source ?? "";
  const files = byDir.has(top.dir) ? [] : dirPrograms(top.dir, project);
  const declared =
    byDir.get(top.dir) ?? declaredFor(files, source, reachResolve(project, top.dir, new Set(files.map((f) => f.path))));
  byDir.set(top.dir, declared);
  return declared(path.slice(top.dir.length), directive, origin);
}
