import { s } from "@keel/schema";

/** The tab on show; the items themselves come from the server. */
export const ViewState = s.object({ show: s.enum(["toBuy", "bought"]) });
