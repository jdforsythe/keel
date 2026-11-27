type Ctx = { net: { fetch(r: Request): Promise<Response> }; clock: { after(ms: number): Promise<void> } };
export async function fetchRetry(ctx: Ctx, url: string, tries: number) {
  for (let i = 0; ; i++) {
    try {
      const res = await ctx.net.fetch(new Request(url));
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } catch (e) {
      if (i === tries - 1) throw e;
      await ctx.clock.after(2 ** i * 100);
    }
  }
}
