import { manifest } from "@keel/router";
import ListPage from "./ListPage.tsx";
import { loadList } from "./loadList.server.ts";
import { shopping } from "./shopping.contract.ts";

export const routes = manifest(shopping, {
  "shopping.list": {
    component: ListPage,
    loader: loadList,
    title: (p) => p.data.text.heading,
  },
});
