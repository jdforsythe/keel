import { s } from "@keel/schema";
import { Item } from "./Item.schema.ts";
import { ListText } from "./ListText.schema.ts";

/** What the list page loads: its copy, the list, and the id of the member it is for, the owner of the marks its outbox queues. */
export const ListData = s.object({ text: ListText, items: s.array(Item), member: s.string().pii("identifier") });
