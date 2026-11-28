type Folder = { readonly forms: readonly string[]; readonly cut: (room: number) => string };

/**
 * A folder's forms, longest first (k.realm One copy): whole; from its holder on (`.../dep/node_modules/@keel/schema`);
 * its holder and last segment (`.../dep/.../schema`). The holder is the segment before its last `node_modules`, with
 * the one before that when it starts `@`; a folder with no holder has two forms, whole and `.../<last segment>`. `cut`
 * gives the last form, or, past `room`, the holder's head that fits and `.../<last segment>` (`.../left-pa.../schema`),
 * at least one unit of the holder kept.
 */
function folderOf(folder: string): Folder {
  const parts = folder.split("/");
  const last = parts[parts.length - 1] ?? folder;
  const nm = parts.lastIndexOf("node_modules");
  if (nm < 1) {
    const end = `.../${last}`;
    return { forms: [folder, end], cut: () => end };
  }
  const from = nm >= 2 && (parts[nm - 2] ?? "").startsWith("@") ? nm - 2 : nm - 1;
  const lead = from > 0 ? ".../" : "";
  const holder = parts.slice(from, nm).join("/");
  const end = `${lead}${holder}/.../${last}`;
  return {
    forms: [folder, `${lead}${parts.slice(from).join("/")}`, end],
    cut: (room) => {
      const keep = Math.max(1, room - lead.length - `.../${last}`.length);
      return keep >= holder.length + 1 ? end : `${lead}${holder.slice(0, keep)}.../${last}`;
    },
  };
}

/**
 * E1765's message at check (k.realm One copy): `two copies of <name> in one realm: <first> and <second>`, in at most
 * 89 UTF-16 code units. Past that each folder takes its next shorter form (`folderOf`), the first before the second at
 * each step, so the dependency that holds a copy stays named; then the holders are cut (`cut`): one whose last form
 * fits in half the room keeps it and the other takes the rest, else each takes half.
 */
export function twoCopiesMessage(name: string, first: string, second: string): string {
  const room = 89 - `two copies of ${name} in one realm:  and `.length;
  const a = folderOf(first);
  const b = folderOf(second);
  const text = (x: string, y: string): string => `two copies of ${name} in one realm: ${x} and ${y}`;
  const at = (f: Folder, i: number): string => f.forms[Math.min(i, f.forms.length - 1)] ?? "";
  for (let i = 0; i < Math.max(a.forms.length, b.forms.length); i++)
    for (const j of i === 0 ? [0] : [i - 1, i])
      if (at(a, i).length + at(b, j).length <= room) return text(at(a, i), at(b, j));
  const half = Math.floor(room / 2);
  const [x, y] = [at(a, 2), at(b, 2)];
  if (x.length <= half) return text(x, b.cut(room - x.length));
  if (y.length <= room - half) return text(a.cut(room - y.length), y);
  return text(a.cut(half), b.cut(room - half));
}
