// A group user's worker (std.multi): its own DOM first, then its own modules, then the calls its group sends.
import { parentPort, workerData } from "node:worker_threads";
import { installDom } from "./installDom.ts";

installDom(typeof workerData === "string" ? workerData : "http://localhost/");
const { userRealm } = await import("./userRealm.ts");
if (parentPort !== null) userRealm(parentPort);
