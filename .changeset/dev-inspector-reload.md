---
"@keel/compiler": patch
---

Under `keel dev`, a server module that calls `inspector()` at its top level can be edited while the server runs: the module evaluated again registers its section in place of the one it registered before (`inspectorsReload`), where it threw E1057 and every dev app path answered 500 until a restart. Two registrations of one id in one load still throw E1057. A changed source outside the project root (a linked package) loads the whole server graph again, so a registry and the modules registered with it are evaluated together.
