import type { Ctx } from "@keel/ctx";
import type { RecordOptions } from "./RecordOptions.ts";
import type { Recorder } from "./Recorder.ts";
import { notImplemented } from "./internal/notImplemented.ts";

/** Record a session on `ctx` (std.sessions API). Placeholder until backlog 0092. */
export function record(_ctx: Ctx, _options: RecordOptions = {}): Recorder {
  throw notImplemented("record");
}
