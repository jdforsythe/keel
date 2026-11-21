---
"@keel/cli": patch
---

MCP tool input schemas emit `additionalProperties: false` only for closed objects (rfc:0029), so each tool's `inputSchema` equals what its operation's `parse` accepts (k.cli conformance; backlog 0138).
