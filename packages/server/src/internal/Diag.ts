/**
 * A log `diag` record (docs/OUTPUT.md) the server emits, e.g. E1554; a throw's carries its app `frames` (k.server Log).
 * `lead`, when set, is the server's own text at the start of `message` (`loader <id> threw: `), which holds no request
 * data: past a scrub cap it is kept and the rest of the message is one mark (`scrubbedDiag`). `tail`, when set, is the
 * server's own text at its end (a thrown value's causes, ` <- Result shop.gone`), kept the same way. Neither is written.
 */
export type Diag = {
  readonly code: string;
  readonly lead?: string;
  readonly tail?: string;
  readonly message: string;
  readonly frames?: readonly string[];
  /** The section a coded refusal names (k.deploy Refusals at start); else the one owning the code (`seeOf`). */
  readonly see?: string;
};
