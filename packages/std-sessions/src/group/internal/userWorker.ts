// A group user's worker (std.multi): its own DOM first, then its own modules, loaded as its project's tests load them,
// then the calls its group sends.
import { parentPort, workerData } from "node:worker_threads";
import { field } from "./field.ts";
import { installDom } from "./installDom.ts";
import { projectLoader } from "./projectLoader.ts";

const origin = field(workerData, "origin");
const user = field(workerData, "user");
if (typeof origin !== "string" || typeof user !== "string") throw new TypeError("group: bad worker data");
await installDom(origin);
const load = await projectLoader(user);
const realm = field(
  await load(new URL(`./userRealm.${import.meta.url.endsWith(".ts") ? "ts" : "js"}`, import.meta.url).href),
  "userRealm",
);
if (typeof realm !== "function") throw new TypeError("group: userRealm did not load");
if (parentPort !== null) {
  Reflect.apply(realm, undefined, [parentPort, load]);
  parentPort.postMessage({ t: "ready" });
}
