---
title: "What Nucleus is"
---

Nucleus is a networking engine for server-authoritative multiplayer games. Its core is engine-agnostic C#, and Unity is one integration layer on top of it, not a dependency it needs.

## The shape of the product

The core lives in `Nucleus/` and targets `netstandard2.1`. Its assembly definition sets `noEngineReferences: true` — a guard, not a formality, that exists so the folder could be junctioned into a Unity project without ever quietly putting `UnityEngine` on the engine's reference path. The core compiles and runs on any .NET host that satisfies netstandard2.1, engine or none.

Everything engine-specific sits above that core as an optional layer: the Unity integration (`Nucleus.Integrations.Unity/`), Blitz Relay (`Nucleus.Integrations.BlitzRelay/`), and Newfarm (`Nucleus.Integrations.Newfarm/`). None of them are things the core links against or needs to function. They consume the core; it does not know they exist.

## What that buys you

The practical result: the same replication code runs in a Unity client and in a headless .NET dedicated server with no Unity install at all. A `NetworkComponent` and its members don't change shape depending on which process is running them.

Concretely, the core replicates in `System.Numerics` types — `Vector3`, `Quaternion` — not `UnityEngine.Vector3` or any other engine's vector types. A dedicated server built from the core alone never touches an engine assembly, and a `Vector3` value that started on a client's transform and crosses the wire arrives as the same `System.Numerics.Vector3` on the other side.

## The three ideas everything else assumes

**Replicated objects are NetworkSystems.** A `NetworkSystem` is the networked entity — it holds and serializes the `NetworkComponent`s attached to it. A `NetworkComponent` in turn holds the actual replicated values as `NetworkMember<T0>` fields:

```csharp
public partial class ChangeDetectionStateComponent : NetworkComponent
{
    public readonly NetworkMember<float> Drift = new(accuracy: 0.1f);
    public readonly NetworkMember<int> CoarseCounter = new(accuracy: 5f);
}
```

A `NetworkMember<T0>` is the unit of replication. Nothing above it — the `NetworkComponent`, the `NetworkSystem` — carries wire values directly.

**The server decides, clients propose.** One side of a connection controls an object's state; every other peer receives what the server decided rather than simulating its own version. A client that wants to affect that state sends a request; it doesn't write the value itself.

**Interest decides what a peer can see.** Visibility isn't global. What a given connection is allowed to see of a given object is resolved per object, per connection, through the interest system (`InterestManager`, `IInterestCondition` and their implementations). A NetworkSystem existing doesn't mean every peer receives it.

## Unreliable-first

There is no reliable channel underneath replication quietly retransmitting every state change until it lands. Acknowledgment rides the packet header of the traffic already flowing, and recovery is targeted at what a peer is actually missing rather than a blanket retransmit. If you're used to a reliable-by-default RPC layer, read the reliability and redundancy docs before assuming state "just arrives" — here, arriving is something the system has to actively account for, not a channel guarantee you get for free.

## Where the pieces live

- `Nucleus/` — the engine-agnostic core: systems, components, members, serializers, interest, transports.
- `Nucleus.Integrations.Unity/` — the Unity layer: MonoBehaviours, inspector-facing components, and the demos.
- `Nucleus.Integrations.BlitzRelay/` and `Nucleus.Integrations.Newfarm/` — the other integration layers.
- `Nucleus.Tests/` — the body of runnable, core-only examples. Reading a component or a test here shows working core code with no engine attached.
