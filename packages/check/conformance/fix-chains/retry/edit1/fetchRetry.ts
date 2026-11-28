import { attempt } from "@keel/schema";
import { Unreachable } from "./Unreachable.schema.ts";
type Io = { net: { fetch(r: Request): Promise<Response> }; clock: { after(ms: number): Promise<void> } };
const once = (io: Io, url: string) =>
  attempt(
    async () => {
      const res = await io.net.fetch(new Request(url));
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    },
    (x) => (x instanceof TypeError ? Unreachable.make({}) : undefined),
  );
export async function fetchRetry(io: Io, url: string, tries: number) {
  for (let i = 0; ; i++) {
    const r = await once(io, url);
    if (r.ok || i === tries - 1) return r;
    await io.clock.after(2 ** i * 100);
  }
}
