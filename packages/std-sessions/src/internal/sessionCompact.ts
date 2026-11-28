import type { SessionRecord } from "../SessionRecord.ts";

/** The compact line of a `session` record (docs/OUTPUT.md): `<fingerprint> <route> <n> events <code|ok>[ -> <file>]`. */
export const sessionCompact = (r: SessionRecord): string =>
  `${r.fingerprint} ${r.route} ${r.events} events ${r.error ?? "ok"}${r.file === null ? "" : ` -> ${r.file}`}`;
