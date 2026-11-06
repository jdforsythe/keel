import { s } from "@keel/schema";
import { transaction } from "@keel/store";
import { board } from "./board.ts";

/** Append a list; a duplicate id leaves the board unchanged. */
export const addList = transaction(
  board,
  "api.addList",
  s.object({ id: s.id("TodoList"), name: s.string({ min: 1, max: 60 }) }),
  (state, p) =>
    state.lists.some((l) => l.id === p.id) ? state : { ...state, lists: [...state.lists, { id: p.id, name: p.name }] },
);
