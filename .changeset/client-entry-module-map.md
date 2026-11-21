---
"@keel/compiler": patch
"@keel/check": patch
---

The client entry binds `service({ contract })` targets only for the modules the client's browser code imports by relative path (and placed stdlib modules), so the names of other server modules are not in the browser build; the entry reads the `keel-peer` tags whenever the topology has a `node` deployable, whether or not a module of it is called. A client build whose graph holds a file of an app module that map leaves out (an alias, a package name, a template `import()`) fails with E1011, naming the module and the importing file; `docs/THREAT-MODEL.md` states it.
