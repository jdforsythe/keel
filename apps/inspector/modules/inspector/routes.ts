import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import InspectError from "./InspectError.tsx";
import InspectorPage from "./InspectorPage.tsx";
import { loadInspect } from "./loadInspect.server.ts";

export const routes = manifest({
  "inspector.index": {
    path: "/",
    search: s.object({ url: s.string().optional() }),
    loader: loadInspect,
    component: InspectorPage,
    errorElement: InspectError,
  },
});
