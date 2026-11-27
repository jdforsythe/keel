import { pathToFileURL } from "node:url";

/** The kernel modules that enter the realm's census (k.realm One copy), as source or as a package's build. */
const CENSUS =
  /[\\/](?:packages|@keel)[\\/](?:schema|store|router|server)[\\/](?:src|dist[\\/]src)[\\/]internal[\\/](?:records|codedError)\.(?:ts|js)$/;

/**
 * `code` of the kernel module `file` with each `import.meta.url` written as that file's URL, for a bundle that
 * inlines it (k.realm One copy): two copies inlined from two folders name their own folders, and the same file
 * bundled again is no second copy. Any other file is `undefined`.
 */
export function censusSource(file: string, code: string): string | undefined {
  const bare = file.replace(/[?#].*$/, "");
  if (!CENSUS.test(bare) || !code.includes("import.meta.url")) return undefined;
  return code.split("import.meta.url").join(JSON.stringify(pathToFileURL(bare).href));
}
