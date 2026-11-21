// A stand-in for tauri-plugin-store 2.5.1 over files of text, as the plugin behaves on disk: `save` is `fs::write`
// (truncate, then write the whole JSON), `reload({ ignoreDefaults: true })` replaces memory with the parsed file and
// rejects with the plugin's messages when the file is missing or does not parse. `cutAfter(n)` lets the next saves
// write `n` bytes in all and then stops the process (the save rejects, the file holds the bytes written so far).

export function pluginStoreFiles() {
  const KILLED = new Error("process killed");
  const files = new Map<string, string>();
  const budget = { left: Number.POSITIVE_INFINITY, saves: 0, failSave: -1 };
  const open = async (path: string) => {
    let memory = new Map<string, unknown>();
    return {
      get: async (k: string) => memory.get(k),
      set: async (k: string, v: unknown) => {
        memory.set(k, v);
      },
      length: async () => memory.size,
      reload: async () => {
        const text = files.get(path);
        if (text === undefined) throw "No such file or directory (os error 2)";
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw "Failed to deserialize store. EOF while parsing a value at line 1 column 0";
        }
        memory =
          typeof parsed === "object" && parsed !== null ? new Map(Object.entries(parsed)) : new Map<string, unknown>();
      },
      save: async () => {
        if (budget.saves++ === budget.failSave) throw new Error("native write failed");
        const bytes = JSON.stringify(Object.fromEntries(memory));
        if (budget.left < bytes.length) {
          files.set(path, bytes.slice(0, budget.left));
          budget.left = 0;
          throw KILLED;
        }
        budget.left -= bytes.length;
        files.set(path, bytes);
      },
    };
  };
  return {
    files,
    open,
    killed: KILLED,
    /** The next saves write `n` bytes in all, then the process stops. */
    cutAfter: (n: number) => {
      budget.left = n;
    },
    /** The `n`th save from now rejects before it touches its file. */
    failSave: (n: number) => {
      budget.failSave = budget.saves + n;
    },
    heal: () => {
      budget.left = Number.POSITIVE_INFINITY;
      budget.failSave = -1;
    },
  };
}
