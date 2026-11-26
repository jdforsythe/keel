import { readFileSync } from "node:fs";
import { join } from "node:path";
import { libraryKind } from "@keel/compiler/std/libraryKind";
import type { ServeOptions } from "../../types/ServeOptions.ts";
import type { Served } from "../../types/Served.ts";
import { e2eError } from "./e2eError.ts";

/** Whether `dir` is a library's own folder (k.library-pack Own folder): its `package.json` marks it `"keel": "library"`. */
function isLibrary(dir: string): boolean {
  try {
    const pkg: unknown = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    if (typeof pkg !== "object" || pkg === null) return false;
    const name: unknown = Reflect.get(pkg, "name");
    return typeof name === "string" && libraryKind(pkg, name) === "library";
  } catch {
    return false;
  }
}

/** `serve({ page, props })` (k.e2e Libraries): E1736 outside a library's own folder. */
export async function libraryPage(dir: string, options: ServeOptions): Promise<Served> {
  if (!isLibrary(dir))
    throw e2eError("E1736", "serve({ page }) runs in a library's own folder; an app serves its own routes", {
      dir,
      page: options.page?.name ?? "",
    });
  throw e2eError("E1736", "serve({ page }) is not built yet", { dir });
}
