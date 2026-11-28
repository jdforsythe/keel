import type { LogRecord } from "../../types/LogRecord.ts";

type Rec = Readonly<Record<string, unknown>>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

/** One line a built server wrote under `KEEL_FORMAT=json` (docs/OUTPUT.md Server log), parsed; `other` when it is no record. */
export function parseLogLine(line: string): LogRecord {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return { kind: "other", text: line };
  }
  if (!isRec(v)) return { kind: "other", text: line };
  const method = str(v.method);
  const path = str(v.path);
  const status = num(v.status);
  const route = str(v.route);
  if (v.kind === "req" && method !== undefined && path !== undefined && status !== undefined)
    return { kind: "req", method, path, ...(route === undefined ? {} : { route }), status, ms: num(v.ms) ?? 0 };
  const code = str(v.code);
  if (v.kind === "diag" && code !== undefined) {
    const see = str(v.see);
    const frames = Array.isArray(v.frames) ? v.frames.filter((f): f is string => typeof f === "string") : undefined;
    return {
      kind: "diag",
      code,
      message: str(v.message) ?? "",
      ...(see === undefined ? {} : { see }),
      ...(frames === undefined ? {} : { frames }),
    };
  }
  if (v.kind === "csp") {
    const directive = str(v.directive);
    const blocked = str(v.blocked);
    const dropped = num(v.dropped);
    return {
      kind: "csp",
      ...(directive === undefined ? {} : { directive }),
      ...(blocked === undefined ? {} : { blocked }),
      ...(route === undefined ? {} : { route }),
      ...(dropped === undefined ? {} : { dropped }),
    };
  }
  const name = str(v.name);
  if (v.kind === "summary" && name !== undefined) {
    const port = num(v.port);
    return { kind: "summary", name, ...(port === undefined ? {} : { port }) };
  }
  return { kind: "other", text: line };
}
