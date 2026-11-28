import { manifest } from "@keel/router";
import { member } from "../members/member.guard.ts";
import { signedIn } from "../members/signedIn.guard.ts";
import ListPage from "./ListPage.tsx";
import { deleteItem } from "./deleteItem.server.ts";
import { getItems } from "./getItems.server.ts";
import { getRuns } from "./getRuns.server.ts";
import { listEvents } from "./listEvents.server.ts";
import { loadList } from "./loadList.server.ts";
import { postBought } from "./postBought.server.ts";
import { postItem } from "./postItem.server.ts";
import { postRun } from "./postRun.server.ts";
import { runEvents } from "./runEvents.server.ts";
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
  "shopping.events": { loader: listEvents.loader },
  "shopping.items": { loader: getItems, guard: member },
  "shopping.add": { action: postItem, guard: member },
  "shopping.toggle": { action: toggleItem, guard: member },
  "shopping.mark": { action: postBought },
  "shopping.remove": { action: deleteItem, guard: member },
  "shopping.runEvents": { loader: runEvents.loader },
  "shopping.runs": { loader: getRuns, guard: member },
  "shopping.run": { action: postRun, guard: member },
});
