import { manifest } from "@keel/router";
import BoomPage from "./BoomPage.tsx";
import HomePage from "./HomePage.tsx";
import ListPage from "./ListPage.tsx";
import ReplacePage from "./ReplacePage.tsx";
import StatusPage from "./StatusPage.tsx";
import { a } from "./a.contract.ts";
import { loadHome } from "./loadHome.server.ts";
import { postHome } from "./postHome.server.ts";
export const routes = manifest(a, {
  "a.home": { component: HomePage, loader: loadHome, POST: postHome },
  "a.status": { component: StatusPage },
  "a.boom": { component: BoomPage },
  "a.list": { component: ListPage },
  "a.replace": { component: ReplacePage },
});
