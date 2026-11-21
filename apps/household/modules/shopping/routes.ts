import { manifest } from "@keel/router";
import { setUp } from "../setup/setUp.guard.ts";
import ListPage from "./ListPage.tsx";
import { deleteItem } from "./deleteItem.server.ts";
import { getItems } from "./getItems.server.ts";
import { loadList } from "./loadList.server.ts";
import { postItem } from "./postItem.server.ts";
import { shopping } from "./shopping.contract.ts";
import { toggleItem } from "./toggleItem.server.ts";

export const routes = manifest(shopping, {
  "shopping.list": { component: ListPage, loader: loadList, guard: setUp, title: (p) => p.data.text.heading },
  "shopping.items": { loader: getItems },
  "shopping.add": { action: postItem },
  "shopping.toggle": { action: toggleItem },
  "shopping.remove": { action: deleteItem },
});
