import { loader } from "@keel/router";
import { err, s } from "@keel/schema";

/** A loader that always fails with `ops.forced`: the router reports it as an `error` event after its `nav`. */
export const forcedLoader = loader({ output: s.string() }, async () =>
  err({ code: "ops.forced", message: "forced for the test", data: null }),
);
