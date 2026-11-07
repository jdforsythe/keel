/** Thrown by every placeholder until backlog 0092 implements std.sessions. */
export const notImplemented = (what: string): Error =>
  new Error(`@keel/std-sessions ${what}: not implemented (backlog 0092)`);
