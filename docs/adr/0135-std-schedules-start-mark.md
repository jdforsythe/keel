# ADR-0135: an entry without a mark stores its start time (RFC 0113)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-17).

**Context.** A schedule entry without a mark started from now, and a fire whose `enqueue` errs stores no mark and rejects `run`. For a new entry whose first `enqueue` erred, the rerun had no mark and started after that fire time, so the fire was never enqueued, under `'once'` too.

**Decision.**
- D1: at start, before it waits, the runner stores the start time as the mark of each entry without one, in `std.schedules.<module>`.
- D2: the Restart rule is otherwise unchanged: a rerun after a failed first fire sees it passed since the mark, and `'once'` enqueues it once under key `<id>@<t>`; `'skip'` none.

**Alternatives.**
- A retry loop inside `run`: a second retry policy beside k.topology's restart, and lost on a crash.
- A mark stored only on `err`: lost when the process dies before the `enqueue`.

**Consequences.**
- No first fire of an entry is lost to a failed `enqueue`.
- A first start writes the marks key once more than before; its value keeps its shape.
