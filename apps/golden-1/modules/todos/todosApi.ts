import { service } from "@keel/services";
import { todos } from "./todos.service.ts";

/**
 * A typed client for the `todos` endpoints at the page's origin. Built per call: `location` does not exist when
 * the compiler evaluates the route manifests in Node.
 */
export function todosApi() {
  return service({ base: location.origin, schema: todos });
}
