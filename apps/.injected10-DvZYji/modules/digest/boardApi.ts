import { service } from "@keel/services";
import { board } from "./board.service.ts";

/**
 * The `api` module's board routes, resolved per call by the topology: in process when `api` is served beside
 * `digest`, else through its peer.
 */
export const boardApi = service({ module: "api", schema: board });
