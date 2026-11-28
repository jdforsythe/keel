import { pathToFileURL } from "node:url";

/** Any use of `import.meta`, spaced or not. */
const META = /\bimport\s*\.\s*meta\b/;
/** A hashbang line, then whitespace, comments and directives: what must stay first in a module. */
const PROLOGUE = /^(?:#![^\n]*\n)?(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/|(["'])use [^"'\n]*\1\s*;?)*/;

/**
 * A build-time evaluation module's code with its own `import.meta` (k.compiler Build-time evaluation): when the code
 * uses it, `const __keelMeta = __keelMetaFor("<file URL>");` after its prologue on the same line, which every
 * `import.meta` of the bundle names (`define`), so `url`, `filename` and `dirname` are the file's, not the bundle's;
 * else the code as it is. Line numbers are kept.
 */
export function withImportMeta(code: string, file: string): string {
  if (!META.test(code)) return code;
  const at = PROLOGUE.exec(code)?.[0].length ?? 0;
  return `${code.slice(0, at)}const __keelMeta = __keelMetaFor(${JSON.stringify(pathToFileURL(file).href)});${code.slice(at)}`;
}
