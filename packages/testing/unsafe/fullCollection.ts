import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { unsafe } from "./unsafe.ts";

let collect: (() => void) | undefined;

/**
 * Run one full garbage collection (k.drive Driving): a resource only a collection would destroy (a synchronous call's
 * job) is then gone. Node gives `gc` to a context made while `--expose-gc` is set; the flag stays set, so workers of one process cannot race on it.
 */
export function fullCollection(): void {
  unsafe(
    "V8 gives no typed garbage collection call: gc is read from a context made while --expose-gc is set, a flag set once per process and never cleared, so worker threads cannot race on it",
    () => {
      if (collect === undefined) {
        const own: unknown = Reflect.get(globalThis, "gc");
        let gc: unknown = own;
        if (typeof gc !== "function") {
          // Set and never cleared: the flag is the process's, so a worker clearing it could take it from another
          // worker between its set and its read; left set, it only gives a later context a gc of its own.
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
    },
  );
}
