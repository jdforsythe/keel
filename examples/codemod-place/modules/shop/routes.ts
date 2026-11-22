import { manifest } from "@keel/router";
import HomePage from "./HomePage.tsx";
import { loadHome } from "./loadHome.server.ts";
import { shop } from "./shop.contract.ts";

export const routes = manifest(shop, {
  "shop.home": { component: HomePage, loader: loadHome, title: () => "Shop" },
});
