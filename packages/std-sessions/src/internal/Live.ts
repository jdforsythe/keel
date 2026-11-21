import type { CtxEvent } from "@keel/ctx";
import type { Recorder } from "../Recorder.ts";
import type { Session } from "../Session.schema.ts";

/**
 * An active recorder on a ctx and its session so far (inspect section `sessions.live`); `note` hands it an event as
 * if its ctx had reported it.
 */
export type Live = { readonly recorder: Recorder; peek(): Session | null; note(event: CtxEvent): void };
