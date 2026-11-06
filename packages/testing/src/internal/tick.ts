/** Resolve after one macrotask, by which point every queued microtask has run. */
export function tick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
