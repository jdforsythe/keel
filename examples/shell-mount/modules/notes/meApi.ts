import { service } from "@keel/services";
import { api } from "../api/api.contract.ts";

/** A typed client for the `api` module; in the shell it calls `KEEL_ORIGIN` with the native cookie store's cookies. */
export const meApi = service({ contract: api });
