---
"@keel/testing": patch
---

`prove` no longer reports a transaction proven in four cases where running it breaks an invariant or throws: `undefined` written under a key of an object literal, a later spread whose optional field is absent (it keeps the earlier value), `===` between two absent options of different sorts (they are equal), and a `Set` of objects or arrays (outside the fragment, E1715). A transaction that writes a possibly absent optional straight into a field (`{ ...state, o: p.o }`) now rejects E1716; guard it or leave the key out.
