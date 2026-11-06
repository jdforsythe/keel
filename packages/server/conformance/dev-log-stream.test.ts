// Clause: The dev log stream emits exactly one `req` record per request; in json mode every line parses.
// Untestable here: the spec names no in-process API for the dev log stream (only `keel dev` stdout); do not invent one.
import { describe, it } from "vitest";

describe("k.server", () => {
  it.todo("The dev log stream emits exactly one `req` record per request; in json mode every line parses");
});
