---
"@keel/std-channels": minor
"@keel/std-sessions": minor
---

The API actions of both packages declare an `output` and answer data: the channel route's `POST` (`channelRoute`) and the session ingest action (`ingestSession`) have `output: s.object({})` and answer `ok({})` where they answered `ok(null)`, so a caller of either route reads `value: {}`; `ChannelRoute.actions.POST` is an `ApiAction`.
