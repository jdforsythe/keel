import { service } from "@keel/services";
import { kitchen } from "./kitchen.service.ts";

/** A typed client for the `kitchen` endpoints at `origin` (`new URL(url).origin` in a loader or action); built per call. */
export function kitchenApi(origin: string) {
  return service({ base: origin, schema: kitchen });
}
