import { readFileSync } from "node:fs";

/** A server-only file: it may import a Node built-in. */
export const stock = (path: string): string => readFileSync(path, "utf8");
