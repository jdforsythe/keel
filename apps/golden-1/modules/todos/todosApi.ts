import { service } from "@keel/services";
import { api } from "../api/api.contract.ts";

/** A typed client for the `api` module's routes, resolved per call by the topology (k.services): in a browser, the page's origin or the `api` peer. */
export const todosApi = service({ contract: api });
