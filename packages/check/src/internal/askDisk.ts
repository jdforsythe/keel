import ts from "typescript";
import type { Probe } from "./Probe.ts";
import { diskText } from "./diskText.ts";
import { listHash } from "./listHash.ts";

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === "string");

/**
 * The file system's answer now to one recorded question (k.check-cache Probes), computed as the recording host
 * computes it, so an unchanged disk gives the recorded answer. A question that does not parse answers nothing.
 */
export function askDisk(kind: Probe[0], question: string): string {
  switch (kind) {
    case "r":
      return diskText(question)?.hash ?? "-";
    case "f":
      return ts.sys.fileExists(question) ? "1" : "0";
    case "d":
      return ts.sys.directoryExists(question) ? "1" : "0";
    case "p":
      return ts.sys.realpath?.(question) ?? question;
    case "l":
      return listHash(ts.sys.getDirectories(question));
    case "x": {
      const v: unknown = JSON.parse(question);
      if (!Array.isArray(v) || typeof v[0] !== "string" || !isStrings(v[1]) || !isStrings(v[3])) return "";
      const excludes = isStrings(v[2]) ? v[2] : undefined;
      const depth = typeof v[4] === "number" ? v[4] : undefined;
      return listHash(ts.sys.readDirectory(v[0], v[1], excludes, v[3], depth));
    }
  }
}
