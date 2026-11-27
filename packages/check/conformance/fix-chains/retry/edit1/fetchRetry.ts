import { attempt } from "@keel/schema";
import { Unreachable } from "./Unreachable.schema.ts";
type Ctx = { net: { fetch(r: Request): Promise<Response> }; clock: { after(ms: number): Promise<void> } };
const once = (ctx: Ctx, url: string) =>
  attempt(
    async () => {
      const res = await ctx.net.fetch(new Request(url));
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    },
    (x) => (x instanceof TypeError ? Unreachable.make({}) : undefined),
  );
export async function fetchRetry(ctx: Ctx, url: string, tries: number) {
  for (let i = 0; ; i++) {
    const r = await once(ctx, url);
    if (r.ok || i === tries - 1) return r;
    await ctx.clock.after(2 ** i * 100);
  }
}
