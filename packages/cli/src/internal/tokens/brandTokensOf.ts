import { isRecord } from "../isRecord.ts";
import { keelModule } from "../keelModule.ts";

/** The `brandTokens` the project at `cwd` resolves from `@keel/ui/brand`, or undefined when it does not. */
export async function brandTokensOf(cwd: string): Promise<Readonly<Record<string, unknown>> | undefined> {
  const brand = await keelModule(cwd, "@keel/ui/brand");
  const tokens = brand?.brandTokens;
  return isRecord(tokens) ? tokens : undefined;
}
