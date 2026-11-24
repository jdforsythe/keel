import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { unsafe } from "./unsafe.ts";

let collect: (() => void) | undefined;

/**
 * Run one full garbage collection (k.drive Driving): a resource only a collection would destroy (a synchronous call's
 * job) is then gone. Node gives `gc` to a context made while `--expose-gc` is set; the flag is cleared again at once.
 */
export function fullCollection(): void {
  unsafe("V8 gives no typed garbage collection call: gc is read from a context made while --expose-gc is set", () => {
    if (collect === undefined) {
      const own: unknown = Reflect.get(globalThis, "gc");
      let gc: unknown = own;
      if (typeof gc !== "function") {
        setFlagsFromString("--expose-gc");
        try {
          gc = runInNewContext("gc");
        } finally {
          setFlagsFromString("--no-expose-gc");
        }
      }
      if (typeof gc !== "function") throw new Error("simulate: this runtime gives no garbage collection call");
      const call = gc;
      collect = () => {
        Reflect.apply(call, undefined, []);
      };
    }
    collect();
  });
}
