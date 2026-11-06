import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { TodoList } from "./TodoList.schema.ts";
import { board } from "./board.ts";

/** The list named by `listId`, else `keel.notFound`. */
export const loadList = loader(TodoList, async ({ params }: { readonly params: { readonly listId: string } }) => {
  const list = board.get("lists").find((l) => l.id === params.listId);
  return list === undefined
    ? err({ code: "keel.notFound", message: `No list ${params.listId}`, data: { listId: params.listId } })
    : ok(list);
});
