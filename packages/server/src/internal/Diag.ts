/**
 * A log `diag` record (docs/OUTPUT.md) the server emits, e.g. E1554; a throw's carries its app `frames` (k.server Log).
 * `lead`, when set, is the server's own text at the start of `message` (`loader <id> threw: `), which holds no request
 * data: past a scrub cap it is kept and the rest of the message is one mark (`scrubbedDiag`). It is never written.
 */
export type Diag = {
  readonly code: string;
  readonly lead?: string;
  readonly message: string;
  readonly frames?: readonly string[];
};
