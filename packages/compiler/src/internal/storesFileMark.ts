import { STORES_FILE_KEY } from "./STORES_FILE_KEY.ts";

/**
 * The mark the `keel dev` plugin puts before an app file's first line (k.data Dev): a call of the `storesFile` the dev
 * server module installed, naming `file`, and nothing where none is installed. It holds no line break, so every line
 * keeps its number, and Vite's SSR transform runs it after the file's imports, as its top level begins.
 */
export function storesFileMark(file: string): string {
  return `globalThis[Symbol.for(${JSON.stringify(STORES_FILE_KEY)})]?.(${JSON.stringify(file)});`;
}
