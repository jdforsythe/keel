/**
 * Wrap a binding's read so that its first value also runs `mark`, which writes it as the control's markup default
 * (the `value` attribute, text, `selected`, `checked`; rfc:0062): server HTML shows it, and later values change the
 * property only, as a browser keeps a default apart from the user's edits.
 */
export function markFirst<T>(read: () => T, mark: (v: T) => void): () => T {
  let first = true;
  return () => {
    const v = read();
    if (first) mark(v);
    first = false;
    return v;
  };
}
