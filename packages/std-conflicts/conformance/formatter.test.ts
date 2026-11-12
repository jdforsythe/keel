// Spec: std.conflicts, clause "The `conflicts.race` formatter renders a race as E2701 and an unchecked entry as W2702 in compact and json."
// Spec: std.conflicts, rule E2701: a rebased entry races its concurrent entries (diag at the file, 1:1).
// Spec: std.conflicts, rule W2702: a rebased entry whose base state cannot be rebuilt (diag at the file, 1:1).
// Seed 1337
// The spec gives the compact line shapes but not the record a `conflicts.race` formatter is given (its fields, nor
// how the file name <file> and an unchecked entry reach it; `Race` itself has a `kind` field that collides with the
// record's `kind`), so the rendering tests are todos carrying that missing fact; nothing is invented. The registration
// test relies only on k.cli: a second `formatter` of one kind is E1053.
import { formatter } from "@keel/cli";
import { s } from "@keel/schema";
import "@keel/std-conflicts";
import { describe, expect, test } from "vitest";

describe("std.conflicts: the conflicts.race formatter", () => {
  test("importing @keel/std-conflicts registers the `conflicts.race` record kind (a second registration is E1053)", () => {
    expect(() => formatter("conflicts.race", { schema: s.object({}), compact: () => "", pretty: () => "" })).toThrow(
      /E1053/,
    );
  });

  test.todo(
    "The `conflicts.race` formatter renders a race as E2701 in compact [missing: the field names of the record it formats, and where <file> comes from]",
  );
  test.todo(
    "The `conflicts.race` formatter renders a race as E2701 in json [missing: the record's schema, since json is the record encoded by its schema]",
  );
  test.todo(
    "The `conflicts.race` formatter renders an unchecked entry as W2702 in compact [missing: the record shape for an unchecked entry, and whether it uses kind `conflicts.race`]",
  );
  test.todo("The `conflicts.race` formatter renders an unchecked entry as W2702 in json [missing: same record schema]");
  test.todo(
    "E2701 compact lists at most two of `against`, then `+n` [missing: same record shape; the exact `+n` spelling, e.g. `, +1`]",
  );
  test.todo("E2701 and W2702 diag the file at 1:1 [missing: same record shape]");
});
