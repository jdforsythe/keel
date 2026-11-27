type Io = { net: { fetch(r: Request): Promise<Response> }; clock: { after(ms: number): Promise<void> } };
export async function fetchRetry(io: Io, url: string, tries: number) {
  for (let i = 0; ; i++) {
    try {
      const res = await io.net.fetch(new Request(url));
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } catch (e) {
      if (i === tries - 1) throw e;
      await io.clock.after(2 ** i * 100);
    }
  }
}
