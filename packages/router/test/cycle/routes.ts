import { manifest } from "../../src/manifest.ts";
import { cyc } from "./contract.ts";
import { save } from "./save.server.ts";

export const routes = manifest(cyc, {
  "cyc.page": { component: () => document.createElement("div"), POST: save },
});
