---
title: "Filing a bug report"
---

## Reproduce it before you file

1. Reproduce it with the server and client as separate processes. A host runs both in one process, which can hide or create behavior, so a repro that only fails in host mode is usually not the bug it looks like.
2. Cut the repro down to one networked object, one member on it, and the smallest scene (Unity) or the smallest `Main` (plain .NET host) that still fails.
3. Run it again with logging set to `LoggerLevel.Information` and capture the output.

## Include these in the report

- The edition: Free or Pro.
- The DLL set you deployed, and confirmation that every DLL came from the same build. A mismatched set, such as an old engine DLL next to a new source-generator DLL, causes failures that look like engine bugs.
- The Unity version, or for a plain host, the target framework you build against (the engine targets `netstandard2.1`).
- Any violations raised, by name, with their context.
- The full log lines, not paraphrased or truncated.
- Counter readings before and after the failure, if it involves a count (packets sent or received, retries, spawned objects).
- The tick or sequence number where the failure happens, if you can identify it.
