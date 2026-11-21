import { manifest } from "@keel/router";
import InspectError from "./InspectError.tsx";
import InspectorPage from "./InspectorPage.tsx";
import { inspector } from "./inspector.contract.ts";
import { loadInspect } from "./loadInspect.server.ts";

export const routes = manifest(inspector, {
  "inspector.index": {
    loader: loadInspect,
    component: InspectorPage,
    errorElement: InspectError,
  },
});
