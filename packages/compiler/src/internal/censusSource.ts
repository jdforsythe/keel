import path from "node:path";
import { pathToFileURL } from "node:url";

/** The kernel modules that enter the realm's census (k.realm One copy), as source or as a package's build. */
const CENSUS =
  /[\\/](?:packages|@keel)[\\/](?:schema|store|router|server)[\\/](?:src|dist[\\/]src)[\\/]internal[\\/](?:records|codedError)\.(?:ts|js)$/;

/**
 * `code` of the kernel module `file` with each `import.meta.url` written as a name for that file, for a bundle that
 * inlines it (k.realm One copy): two copies inlined from two folders name their own folders, and the same file
 * bundled again is no second copy. `place` says what the name is relative to, so a bundle holds no folder of the
 * machine that built it: `{ project }` for a browser bundle, the file's path from the project; `{ bundle }` for a
 * server bundle, the folder its file is written to, the path from there resolved against the bundle's own URL when
 * it runs, so E1765 names a file URL of the machine that starts it. With no `place` (a bundle evaluated in this
 * process), the file's URL. Any other file is `undefined`.
 */
export function censusSource(
  file: string,
  code: string,
  place?: { readonly project: string } | { readonly bundle: string },
): string | undefined {
  const bare = file.replace(/[?#].*$/, "");
  if (!CENSUS.test(bare) || !code.includes("import.meta.url")) return undefined;
  const rel = (from: string): string => path.relative(from, bare).split(path.sep).join("/");
  const name =
    place === undefined
      ? JSON.stringify(pathToFileURL(bare).href)
      : "project" in place
        ? JSON.stringify(rel(place.project))
        : `new URL(${JSON.stringify(rel(place.bundle))}, import.meta.url).href`;
  return code.split("import.meta.url").join(name);
}
