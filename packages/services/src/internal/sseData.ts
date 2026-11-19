/**
 * The `data` of each event in a `text/event-stream` body, in order: `data:` lines (one optional space after the colon)
 * joined by a blank line; comment (`:`) and other field lines are skipped. Ends with the body, or when `signal` aborts
 * (the body is cancelled). A body that errors throws.
 */
export async function* sseData(body: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader();
  const stop = (): void => {
    reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", stop, { once: true });
  const dec = new TextDecoder();
  let buf = "";
  let data: string[] = [];
  try {
    for (;;) {
      const r = await reader.read();
      if (r.done || signal.aborted) return;
      buf += dec.decode(r.value, { stream: true });
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line === "" && data.length > 0) {
          yield data.join("\n");
          data = [];
        } else if (line.startsWith("data:")) data.push(line.slice(line.startsWith("data: ") ? 6 : 5));
      }
    }
  } finally {
    signal.removeEventListener("abort", stop);
  }
}
