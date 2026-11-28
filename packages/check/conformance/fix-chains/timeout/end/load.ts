import { attempt } from "@keel/schema";
import type { Result } from "@keel/schema";
import { Timeout } from "./Timeout.schema.ts";
type Net = { get(): Promise<string> };
export const load = (net: Net): Promise<Result<string, ReturnType<typeof Timeout.make>>> =>
  attempt(
    () => net.get(),
    (x) => (x instanceof Error && x.name === "TimeoutError" ? Timeout.make({}) : undefined),
  );
