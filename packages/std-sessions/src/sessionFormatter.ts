// Registers the `session` record formatter (k.cli `formatter`). Reached from `./tools` only.
import { formatter } from "@keel/cli";
import { SessionRecord } from "./SessionRecord.ts";
import { sessionCompact } from "./internal/sessionCompact.ts";

const pretty = (r: SessionRecord): string =>
  `session ${r.fingerprint} ${r.route}: ${r.events} events, ${r.inputs} inputs, ${r.error ?? "ok"}${
    r.file === null ? "" : `\n  file: ${r.file}`
  }`;

formatter("session", { schema: SessionRecord, compact: sessionCompact, pretty });
