---
"@keel/compiler": minor
"@keel/cli": minor
---

`keel build` writes `dist/<name>/` for every `client` deployable: `index.html` (the project's, else a default one), content-hashed `assets/` and `keel-mark.svg`, every URL root-absolute, ready for any static host. **Path change:** the client build no longer lands in `dist/`; a deploy step that uploads `dist/index.html` and `dist/assets/` uploads `dist/<name>/` instead. For each `node` deployable whose `KEEL_PEER_<NAME>` is set at build, `index.html` carries `<meta name="keel-peer" data-deployable="<name>" content="<origin>">`, and the generated client entry binds `service({ module })` to it; a value that is not an http(s) origin fails the build with E1565 naming the key. A `client` deployable may declare `host: '<node deployable>'`: that deployable's build then includes the client's files. E1566 refuses a bad `host`, including one that is not a string literal. `@keel/compiler/hosting/*` exports `originOf`, `peerOrigins` and `hostProblems`.
