// A scripted stand-in for the native `KeelHttp` plugin: each request waits until the test answers it, events go to the
// listeners present when they are sent, and `live()` counts the listeners not yet removed (not a test file).
type Listener = (e: { id: string; data?: string; message?: string }) => void;
type Head = { status: number; headers: Record<string, string> };

const listeners = new Set<{ name: string; cb: Listener }>();
const pending = new Map<string, { ok(h: Head): void; no(e: Error): void }>();
const cancelled: string[] = [];
const ids: string[] = [];

export const fakeKeelHttp = {
  cancelled,
  ids,
  live: (): number => listeners.size,
  reset(): void {
    listeners.clear();
    pending.clear();
    fakeKeelHttp.cancelled.length = 0;
    fakeKeelHttp.ids.length = 0;
  },
  /** Resolves the request `id` with its headers. */
  head(id: string, h: Head): void {
    pending.get(id)?.ok(h);
  },
  /** Rejects the request `id` before its headers. */
  refuse(id: string): void {
    pending.get(id)?.no(new Error("Connection refused"));
  },
  emit(name: "chunk" | "end" | "fail", e: { id: string; data?: string; message?: string }): void {
    for (const l of [...listeners]) if (l.name === name) l.cb(e);
  },
  plugin: {
    request(o: { id: string }): Promise<Head> {
      fakeKeelHttp.ids.push(o.id);
      return new Promise<Head>((ok, no) => pending.set(o.id, { ok, no }));
    },
    async cancel(o: { id: string }): Promise<void> {
      fakeKeelHttp.cancelled.push(o.id);
    },
    async addListener(name: string, cb: Listener): Promise<{ remove(): Promise<void> }> {
      const l = { name, cb };
      listeners.add(l);
      return {
        async remove() {
          listeners.delete(l);
        },
      };
    },
  },
};
