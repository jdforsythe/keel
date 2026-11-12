// Spec: std.multi, clause "E2007 and E2008 each fire on a fixture and not on its clean twin."
// Spec: std.multi, rule E2007: a group file fails `SessionGroup` (diag at the file, 1:1).
// Spec: std.multi, rule E2008: a group user's session has no `seed` (diag at the file, 1:1).
// Seed 1337
// Untestable as written: the spec names no command, API or check surface that reads a group file and emits the diag
// (std.sessions' E2002 comes from `keel session replay <f>`; std.multi names none), and no export spelling for the
// `SessionGroup` schema. Each test below is a todo carrying the missing fact; nothing is invented.
import { describe, test } from "vitest";

describe("std.multi: E2007 and E2008", () => {
  test.todo(
    "E2007 fires on a group file that fails SessionGroup [missing: which command or surface reads a group file and emits the diag]",
  );
  test.todo(
    "E2007 does not fire on its clean twin, a group file recorded by openGroup [missing: same command or surface]",
  );
  test.todo("E2007 and E2008 diag the file at 1:1 [missing: same command or surface, and the compact line format]");
  test.todo("E2008 fires on a group file whose user session has no seed [missing: same command or surface]");
  test.todo("E2008 does not fire on its clean twin, every user session seeded [missing: same command or surface]");
});
