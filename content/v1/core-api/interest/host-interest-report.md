---
title: "The host interest report"
---

> **Using Unity?** See [Making a host see what its players see](../../unity/interest/host-visibility-in-unity).

## What it answers

A host runs the authority and a client in the same process, so it already holds every object in the world. That leaves it no way to know what its own client half would actually have been sent, unless something resolves the question and hands back an answer. `InterestManager.HostInterestEnabled` does that: turned on, the interest pass also resolves the host's own client against the registered conditions, exactly as it would a remote client.

The answer is a report, never a decision. A host is the authority, and nothing is culled, no observer is dropped, and no despawn is written for it because of this resolution. The object goes on existing, replicating, and being controllable exactly as it always did. All that changes is that the engine now tells you what a client in the host's position would be holding.

## Reading the report

Each `NetworkSystem` exposes what its resolution settled on:

```csharp
public InterestMembership HostInterestMembership { get; private set; }
```

And raises a change to it:

```csharp
public event HostInterestChangedHandler? HostInterestChanged;

public delegate void HostInterestChangedHandler(InterestMembership previousInterestMembership, InterestMembership currentInterestMembership);
```

`HostInterestChanged` is raised only on a host, and only while `HostInterestEnabled` is set. A dedicated server has no client half to answer for, and a client is already told the same thing directly by its own spawns and despawns, so neither ever raises it. It arrives on the network loop thread inside the serialization pass, on the interest cadence, and a handler is free to do engine work with it.

## Which membership is worth acting on

`HostInterestMembership` reads `InterestMembership.Streamed` everywhere the question does not arise: on a client, on a dedicated server, and on a host with `HostInterestEnabled` cleared.

`InterestMembership.Unspawned` is the one that means the object would not be there at all, and is therefore the one worth hiding on. `InterestMembership.Stopped` means a client would still be looking at the object while receiving nothing further for it, so hiding on `Stopped` shows the host less than its players see.

## The return guarantee

A system leaving the world, or the host's client half dropping its link, returns the membership to `InterestMembership.Streamed` and raises that too. A handler that hid something on `Unspawned` is always told to put it back, rather than being left holding an invisible object.

## Why it is off by default

Resolving the host's own client costs the host connection an ordinary condition pass per evaluated pair, the same one every remote client already pays. A world pays that cost for an answer it may have nothing to do with, so the report stays off until a game asks for it. Turn it on in a host world that should see what its players see, and leave it alone on a dedicated-server build, which has no client half to answer for.

## Which conditions can honestly differ for a host

A condition that is structurally meaningless for a host still exempts itself. The bundle gate is the clearest case: a host's own client shares the process with the server and so already holds every content bundle the server loaded, so `BundleInterestCondition` abstains for it:

```csharp
if (connection.IsLocalPeer || connection.IsHostLoopback)
    return InterestResult.None;
```

The scene condition is not one of those. A host is placed in scene instances by the same protocol as any other client and records the instances it was placed in, so the scene gate reads a host's real scene records and settles against them the same way it would for a remote client. What resolves honestly for a host is what can honestly differ for it: position and scene above all.
