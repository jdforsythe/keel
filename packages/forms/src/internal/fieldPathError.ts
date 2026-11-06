/** E1902: `field(path)` with a path not in the form's schema (k.forms). */
export function fieldPathError(path: string): Error & { code: "E1902"; see: string } {
  const shown = path.length > 60 ? `${path.slice(0, 57)}...` : path;
  return Object.assign(new Error(`E1902 field path ${JSON.stringify(shown)} is not in the schema`), {
    code: "E1902" as const,
    see: "k.forms",
  });
}
