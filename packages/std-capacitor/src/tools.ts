// `@keel/std-capacitor/tools`: the CLI-time half that `keel check` and `keel build` load for a project declaring
// `capacitor`. It registers the Capacitor shell target (std.capacitor). No exports.
import { shellTarget } from "@keel/cli";
import { capacitorTarget } from "./tools/capacitorTarget.ts";

shellTarget("capacitor", capacitorTarget);
