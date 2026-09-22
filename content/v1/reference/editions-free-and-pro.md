---
title: "Free and Pro Editions"
---

## The split is file absence

Nucleus.csproj declares a `NucleusEdition` property that defaults to `Pro`. Building with `-p:NucleusEdition=Free` adds one `Compile Remove` for every `*.Pro.cs` file in the project. No edition symbol is defined anywhere, and nothing is wrapped in `#if`. A Pro member is reachable by an ordinary call in source; deleting the files that declare it is the only thing that makes it stop existing.

This is why a page documenting Pro surface says so at the top: the split is not a runtime license check, it is which files were on disk when the assembly was compiled.

## What that means on Free

Referencing a Pro type in a Free build is a compile error naming a type that does not exist, not a caught exception or a silent no-op. There is no attribute to query and no capability flag to check at runtime. If a type or member is documented as Pro and it does not compile against a Free build, that is expected, not a bug to report.

## What the Pro files carry today

83 `*.Pro.cs` files under `Nucleus/`, and 14 under `Nucleus.Integrations.Unity/`. Between them they carry: delta projection, distance and grid interest, level of detail, spawn pacing, multi-writer state write access, content bundles, predicted spawn and despawn and spawn compensation, world persistence, packet transforms, and host adoption.

## The one wire consequence

Pro packs replicated lengths more tightly than Free, which writes every length exactly. This is the one place the edition split forks the wire format itself: a Free peer and a Pro peer encode this layer differently, so they cannot understand each other's packets at it. Every peer in a session — the server and every client — has to be built from the same edition. Mixing Free and Pro peers doesn't just cost more bandwidth, it corrupts what the mismatched side reads. This isn't a per-world toggle; it's fixed by which edition built each peer.

## The one enum that isn't compiled out

`SendInterval.Short` and `SendInterval.Long` stay declared in a Free build even though pacing is a Pro feature, because an enum cannot be partial. What's absent on Free is the hook that turns a span into ticks: a Free build resolves every interval to a single tick and replicates every changed tick, which is `SendInterval.Normal`. Naming `Short` or `Long` in Free compiles and paces nothing — this is what lets one prefab load correctly in either edition.

`TransmissionMode.Divine` gets the same treatment, for the same reason: the enum itself is not a `*.Pro.cs` file, so naming `Divine` directly compiles in Free too. What's absent is the hook that reads it, so a Free build's members stay on ordinary interval-paced replication regardless of which mode they were built with. Framework components like `TransformComponent` still name `TransmissionModeDefaults.Motion` instead of the mode directly, so the same source is correct in either edition without checking which one it was built as.

## Build hazard

Both editions build to the same Release output path, so building one after the other overwrites the previous edition's DLL. Rebuild whichever edition you need last, immediately before deploying it.

## Current status

The Free build path compiles and works. No Free package is produced yet — treat any edition badge on the product site as intent, not an artifact.
