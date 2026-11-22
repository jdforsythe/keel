import { manifest } from "@keel/router";
import { member } from "../members/member.guard.ts";
import { signedIn } from "../members/signedIn.guard.ts";
import ListPage from "./ListPage.tsx";
import { deleteItem } from "./deleteItem.server.ts";
import { getItems } from "./getItems.server.ts";
import { loadList } from "./loadList.server.ts";
import { postItem } from "./postItem.server.ts";
import { shopping } from "./shopping.contract.ts";
import { toggleItem } from "./toggleItem.server.ts";

export const routes = manifest(shopping, {
  "shopping.list": {
    component: ListPage,
    layout: "app.frame",
    loader: loadList,
    guard: signedIn,
    title: (p) => p.data.text.heading,
  },
  "shopping.items": { loader: getItems, guard: member },
  "shopping.add": { action: postItem, guard: member },
  "shopping.toggle": { action: toggleItem, guard: member },
  "shopping.remove": { action: deleteItem, guard: member },
});
