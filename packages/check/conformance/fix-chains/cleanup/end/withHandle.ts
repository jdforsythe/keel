type Handle = { close(): void };
export function withHandle(h: Handle, use: (h: Handle) => void): void {
  try {
    use(h);
  } finally {
    h.close();
  }
}
