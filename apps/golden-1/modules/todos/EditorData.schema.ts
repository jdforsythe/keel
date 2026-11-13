import { s } from "@keel/schema";

/** The editor chart's own data: how many times the current edit has been sent, at most 3. */
export const EditorData = s.object({ attempts: s.int({ min: 0, max: 3 }) });
export type EditorData = s.infer<typeof EditorData>;
