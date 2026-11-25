import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";

let collect: (() => void) | undefined;

/**
 * Run one full garbage collection (k.drive Driving): a resource only a collection would destroy (a synchronous call's
 * job) is then gone. Node gives `gc` to a context made while `--expose-gc` is set. Hazard: the flag is the process's
 * and is set once and never cleared, so worker threads of one process cannot race on it (a worker clearing it could
 * take it from another between its set and its read); left set, it only gives a later context a `gc` of its own.
 */
export function fullCollection(): void {
  if (collect === undefined) {
    let gc: unknown = Reflect.get(globalThis, "gc");
    if (typeof gc !== "function") {
      setFlagsFromString("--expose-gc");
      gc = runInNewContext("gc");
    }
    if (typeof gc !== "function") throw new Error("simulate: this runtime gives no garbage collection call");
    const call = gc;
    collect = () => {
      Reflect.apply(call, undefined, []);
    };
  }
  collect();
}
