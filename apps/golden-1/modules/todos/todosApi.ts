import { service } from "@keel/services";
import { todos } from "./todos.service.ts";

/**
 * A typed client for the `todos` endpoints at `origin`: `new URL(url).origin` in a loader or action (server code never
 * reads `location`, k.server API), `location.origin` in a component. Built per call.
 */
export function todosApi(origin: string) {
  return service({ base: origin, schema: todos });
}
