// Generated from OpenAPI by `keel scaffold service` (k.services); do not edit.
import { service } from "@keel/services";
import { OrdersApi } from "./api.schema.ts";

export const api = service({ base: "https://api.example.com", schema: OrdersApi });
