// Generated from OpenAPI by `keel scaffold service` (k.services); do not edit.
import { service } from "@keel/services";
import { AppApi } from "./AppApi.schema.ts";

export const api = service({ base: "http://localhost:4417", schema: AppApi });
