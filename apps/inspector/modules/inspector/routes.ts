import { manifest } from "@keel/router";
import InspectError from "./InspectError.tsx";
import { InspectSearch } from "./InspectSearch.schema.ts";
import InspectorPage from "./InspectorPage.tsx";
import { loadInspect } from "./loadInspect.server.ts";

export const routes = manifest({
  "inspector.index": {
    path: "/",
    search: InspectSearch,
    loader: loadInspect,
    component: InspectorPage,
    errorElement: InspectError,
  },
});
