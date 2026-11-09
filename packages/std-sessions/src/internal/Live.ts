import type { Recorder } from "../Recorder.ts";
import type { Session } from "../Session.schema.ts";

/** An active recorder on a ctx and its session so far (inspect section `sessions.live`). */
export type Live = { readonly recorder: Recorder; peek(): Session | null };
