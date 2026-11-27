import path from "node:path";
import { pathToFileURL } from "node:url";

/** The kernel modules that enter the realm's census (k.realm One copy), as source or as a package's build. */
const CENSUS =
  /[\\/](?:packages|@keel)[\\/](?:schema|store|router|server)[\\/](?:src|dist[\\/]src)[\\/]internal[\\/](?:records|codedError)\.(?:ts|js)$/;

/**
 * `code` of the kernel module `file` with each `import.meta.url` written as that file's URL, for a bundle that
 * inlines it (k.realm One copy): two copies inlined from two folders name their own folders, and the same file
 * bundled again is no second copy. Given `root`, for a browser bundle, the name is the file's path relative to it,
 * so a page names no folder of the machine that built it. Any other file is `undefined`.
 */
export function censusSource(file: string, code: string, root?: string): string | undefined {
  const bare = file.replace(/[?#].*$/, "");
  if (!CENSUS.test(bare) || !code.includes("import.meta.url")) return undefined;
  const name = root === undefined ? pathToFileURL(bare).href : path.relative(root, bare).split(path.sep).join("/");
  return code.split("import.meta.url").join(JSON.stringify(name));
}
