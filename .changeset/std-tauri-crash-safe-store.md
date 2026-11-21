---
"@keel/std-tauri": patch
---

The Tauri storage driver keeps two whole copies, `keel.json` and `keel.b.json`, each with a generation and a checksum, and saves the next copy to the file it did not read from before the other, so a crash inside a save leaves the earlier or the new state. A file cut short is never read as an empty store, and files holding no whole copy make every call reject without being overwritten.
