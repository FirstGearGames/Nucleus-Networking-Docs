---
title: "Filing a bug report"
---

## What to include

State the edition: Free or Pro. The edition is a compile-time choice, not a runtime flag — a Free build is produced with `-p:NucleusEdition=Free`, which drops every `*.Pro.cs` file from the compilation, so a report that says "Free" or "Pro" is telling us which files exist in the build, not a setting that could be misread.

List the DLL set you deployed, and confirm every one of those DLLs came from the same build. A mismatched set (an old engine DLL next to a new source-generator DLL, for example) produces failures that look like engine bugs but are actually version skew. If Unity is involved, give the Unity version. If it's a plain host, give the target framework you're building against (the engine itself targets `netstandard2.1`).

## Before you file

Reproduce it outside host mode first. A host runs both the server and client sides of the connection in the same process, and that dual role masks or manufactures behavior that a real client/server split does not show. If a repro only fails when hosting, it usually isn't the bug it looks like — narrow it to a genuine two-process reproduction before filing.

Reproduce it again with logging set to `LoggerLevel.Information` and capture the output. Information is verbose enough to show the sequence of events leading into the failure without needing a rebuild.

Say which violations were raised, if any. The engine reports rule breaks through `IViolation` payloads dispatched by the violation system; if your repro triggers one, name it and include its context.

## Building a minimal repro

Minimal means: one networked object, one member on it, and the smallest scene (Unity) or the smallest `Main` (plain host) that reproduces the failure. Strip everything not required to trigger it — other systems, other objects, other members — before filing.

A repro that only fails in host mode is usually not the bug you think it is. Confirm it reproduces with the server and client as separate processes before treating it as real.

## Attaching evidence

Include:

- The log lines, full text, not paraphrased or truncated.
- Counter readings before and after the failure, if the behavior involves a count (received/sent packets, retries, spawned objects, etc.).
- The exact tick or sequence number at which the failure occurs, if you can identify it.

Evidence in this shape is what lets a report be reproduced from the outside, rather than argued about.
