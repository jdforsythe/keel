const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** `data` of the text of a `.keel/<name>.json` artifact, or `{}` when the text is missing, not JSON, or has no `data`. */
export function artifactData(text: string): unknown {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) && isRecord(parsed.data) ? parsed.data : {};
  } catch {
    return {};
  }
}
