import { unsafe } from "./unsafe.ts";

/** Throws the error `message` names: a chart or an instance the app declared wrongly (std.statecharts). */
export function refuse(message: string): never {
  return unsafe(
    "std.statecharts specifies a chart that fails its analysis and an instance key outside its form as a throw at declaration: a bug in the app's code, never an expected failure a Result would carry",
    () => {
      throw new Error(message);
    },
  );
}
