/**
 * An issue or comment body: the compact `session` record, then (for an issue) the emitted test, each in a fenced
 * block one backtick longer than any backtick run inside, so the test's own text cannot close it.
 */
export function issueBody(record: string, test?: string): string {
  const runs = [...`${record}\n${test ?? ""}`.matchAll(/`+/g)].map((m) => m[0].length);
  const fence = "`".repeat(Math.max(2, ...runs) + 1);
  const head = `${fence}text\n${record}\n${fence}\n`;
  if (test === undefined) return head;
  return `${head}\n${fence}ts\n${test}${test.endsWith("\n") ? "" : "\n"}${fence}\n`;
}
