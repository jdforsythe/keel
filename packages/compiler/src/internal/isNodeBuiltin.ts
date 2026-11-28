import { NODE_BUILTINS } from "./NODE_BUILTINS.ts";

/** Whether `id` names a Node built-in (k.bundle Node built-ins): any `node:` specifier, or a name Keel's list holds. */
export function isNodeBuiltin(id: string): boolean {
  return id.startsWith("node:") || NODE_BUILTINS.has(id);
}
