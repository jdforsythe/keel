/** The body of `res` as text when it is at most `limit` bytes; undefined when longer or unreadable. Stops reading past `limit`. */
export async function readWithin(res: Response, limit: number): Promise<string | undefined> {
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  try {
    for (let part = await reader?.read(); part !== undefined && !part.done; part = await reader?.read()) {
      size += part.value.length;
      if (size > limit) {
        reader?.cancel().catch(() => undefined);
        return undefined;
      }
      text += decoder.decode(part.value, { stream: true });
    }
  } catch {
    return undefined;
  }
  return text + decoder.decode();
}
