import { manifest } from "../../src/manifest.ts";
import { save } from "./save.server.ts";

export const routes = manifest({ "cyc.page": { path: "/cyc", component: () => document.createElement("div") } });
routes.actions({ "cyc.page": { POST: save } });
