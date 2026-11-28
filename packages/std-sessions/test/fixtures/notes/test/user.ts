import { routes } from "../modules/notes/routes.ts";

/** A session group's user module (std.multi): the `notes` routes, each user starting at `notes.home`. */
export { routes };
export const base = { id: "notes.home", params: {}, search: {} };
