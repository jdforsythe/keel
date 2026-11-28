# deploy
| id | holds |
|-|-|
| k.topology | deployables, route table, runners, peers calls, local topology and dev watcher |
| k.deploy | production entry, asset serving, storage per deployable and deploy files |
| k.hosting | client and static build output, peers, allowed origins and `servedBy` |
| k.compat | the `.keel/surface.json` file, what a change may accept and stored data checks |
| k.shell | native shell context, drivers, origins, shell target, plugins and build |
| k.scaffold-shell | the `keel scaffold shell` command: input, file edits and refusals |
| k.return | mount requests from a shell, external browser, return links and sign-out |
| k.opening | which mount requests record an opening and how the stored value is read |
| k.links | return links a shell accepts, how a launch is reported and their limits |
| std.shells | storage and net drivers for the Capacitor and Tauri shells |
| std.capacitor | Capacitor target: Android and iOS files, tools, build and CI jobs |
| std.tauri | Tauri target: desktop files, tools, build and CI job |
