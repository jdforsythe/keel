import { service } from "@keel/services";
import { todos } from "./todos.service.ts";

/** A typed client for the `api` module's board routes, resolved per call by the topology (k.services): in a browser, the page's origin or the `api` peer. */
export const todosApi = service({ module: "api", schema: todos });
