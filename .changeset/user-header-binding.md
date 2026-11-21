---
"@keel/server": patch
"@keel/services": patch
---

The `x-keel-user` header a `service({ module })` call carries is signed for the request's body and the receiving deployable; a receiver ignores one whose expiry is more than 65 s ahead of its clock, and a `user` over 256 characters is refused by the sender and ignored by the receiver.
