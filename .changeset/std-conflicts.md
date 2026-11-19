---
"@keel/std-conflicts": minor
---

`@keel/std-conflicts`: `races(snapshot, stores)` checks each rebased entry of a stored server store against its concurrent entries in both orders (`order` and `invalid` races, `folded` and `undo` unchecked entries); `findRaces(group, { user, serve, stores })` replays a session group and checks every server store; `raceRecords` and the `conflicts.race` formatter render them as E2701 and W2702.
