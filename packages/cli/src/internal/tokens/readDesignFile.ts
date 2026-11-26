import type { DesignFile } from "./DesignFile.ts";
import { collectTokens } from "./collectTokens.ts";
import { fileMode } from "./fileMode.ts";
import { jsonTree } from "./jsonTree.ts";

/** The design tokens file `path` with `text`, or undefined when `text` is not JSON, not an object, or holds no token (`$value`). */
export function readDesignFile(path: string, text: string): DesignFile | undefined {
  const root = jsonTree(text);
  if (root?.kind !== "object") return undefined;
  const tokens = collectTokens(root);
  return tokens.length === 0 ? undefined : { path, text, tokens, ...fileMode(path) };
}
