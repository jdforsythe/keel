import { type SchemaError, attempt, err } from "@keel/schema";
import { Feed } from "./Feed.schema.ts";
import { HttpFailed } from "./HttpFailed.schema.ts";
import { Unreachable } from "./Unreachable.schema.ts";
type FeedError = ReturnType<typeof HttpFailed.make> | ReturnType<typeof Unreachable.make> | SchemaError;
type Io = { net: { fetch(r: Request): Promise<Response> }; clock: { after(ms: number): Promise<void> } };
const once = (io: Io, url: string) =>
  attempt(
    async () => {
      const res = await io.net.fetch(new Request(url));
      return res.ok ? Feed.parseJson(await res.text()) : err(HttpFailed.make({ status: res.status }));
    },
    (x) => (x instanceof TypeError ? Unreachable.make({}) : undefined),
  );
const again = (e: FeedError): boolean =>
  e.code === "feed.unreachable" || (e.code === "feed.http" && e.data.status >= 500);
export async function fetchRetry(io: Io, url: string, tries: number) {
  for (let i = 0; ; i++) {
    const r = await once(io, url);
    if (r.ok || i === tries - 1 || !again(r.error)) return r;
    await io.clock.after(2 ** i * 100);
  }
}
