import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { TodoList } from "./TodoList.schema.ts";
import { refreshView } from "./refreshView.ts";

/** The list named by `listId` from a fresh board (`refreshView`), else `keel.notFound`. */
export const loadList = loader(TodoList, async ({ params }: { readonly params: { readonly listId: string } }, ctx) => {
  const board = await refreshView(ctx);
  if (!board.ok) return board;
  const list = board.value.lists.find((l) => l.id === params.listId);
  return list === undefined
    ? err({ code: "keel.notFound", message: `No list ${params.listId}`, data: { listId: params.listId } })
    : ok(list);
});
