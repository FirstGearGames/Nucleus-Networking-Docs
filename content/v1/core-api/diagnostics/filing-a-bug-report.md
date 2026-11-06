---
title: "Filing a bug report"
---

## Before you file

1. Reproduce it with the server and client in separate processes. A host runs both in one process, which can hide or create behavior a real split does not show, so a failure that only appears when hosting is usually not the bug it looks like.
2. Cut the repro down to one networked object, one member on it, and the smallest scene (Unity) or `Main` (plain host) that still fails.
3. Run it again with logging at `LoggerLevel.Information` and capture the output.

## Include in the report

- The edition: Free or Pro.
- The DLLs you deployed, all from the same build. A mixed set, such as an old engine DLL next to a new source generator DLL, fails in ways that look like engine bugs.
- The Unity version, or for a plain host, the target framework you build against (the engine targets `netstandard2.1`).
- Any violations raised, with their context.
- The full log lines, not paraphrased or truncated.
- Counter readings before and after the failure, if it involves a count (packets sent or received, retries, spawned objects).
- The tick or sequence number where it fails, if you can find it.
