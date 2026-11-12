# @keel/std-offline

**Spec:** std.offline · **Status:** proposed · **verified:** (none)

An outbox of writes made offline: each keeps its key and base, goes out in order on reconnect, and waits for the user when refused.
