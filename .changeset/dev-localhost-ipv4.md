---
"@keel/cli": patch
---

`keel dev` looks up names IPv4 first, so Vite's default host `localhost` binds 127.0.0.1, which every client resolving `localhost` reaches, including on machines without a non-loopback IPv6 address.
