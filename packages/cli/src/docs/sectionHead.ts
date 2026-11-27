/** A section's title and status from its first two lines, `# <id>: <title>` and `status: <status>` (k.docs Areas). */
export function sectionHead(text: string, id: string): { title: string; status: string } {
  const [first = "", second = ""] = text.split("\n", 2);
  const title = first.startsWith(`# ${id}: `) ? first.slice(id.length + 4).trim() : id;
  const status = /^status:[ \t]*(.*)$/.exec(second)?.[1]?.trim() ?? "";
  return { title, status };
}
