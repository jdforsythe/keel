import { routes } from "../modules/todos/routes.ts";

/** A session group's user module (std.multi): the `todos` routes, each user starting at `todos.index`. */
export { routes };
export const base = { id: "todos.index", params: {}, search: {} };
