/**
 * True when a file's first line is a generated marker (`// _generated: ...` of turbo.json and tooling, `# _generated`
 * of CI, `// Generated from OpenAPI ...` of `scaffold service`): its content is read-only (E1005).
 */
export function isGeneratedSource(text: string): boolean {
  return /^(?:\/\/|#) ?(?:_generated|Generated)\b/.test(text);
}
