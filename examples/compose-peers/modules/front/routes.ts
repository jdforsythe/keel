import { manifest } from "@keel/router";
import HomePage from "./HomePage.tsx";
import { front } from "./front.contract.ts";
import { loadHome } from "./loadHome.server.ts";

export const routes = manifest(front, {
  "front.home": { component: HomePage, loader: loadHome, title: () => "Two peers" },
});
