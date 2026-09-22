---
title: "What Nucleus is"
---

Nucleus is a networking engine for authoritative multiplayer games. Its core is engine-agnostic C#, and Unity is one integration layer on top of it, not a dependency it needs.

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

**The authority decides, clients propose.** One side of a connection is authoritative over an object's state; every other peer receives what the authority decided rather than simulating its own version. A client that wants to affect authoritative state sends a request; it doesn't write the value itself.

**Interest decides what a peer can see.** Visibility isn't global. What a given connection is allowed to see of a given object is resolved per object, per connection, through the interest system (`InterestManager`, `IInterestCondition` and their implementations). A NetworkSystem existing doesn't mean every peer receives it.

## Unreliable-first

There is no reliable channel underneath replication quietly retransmitting every state change until it lands. Acknowledgment rides the packet header of the traffic already flowing, and recovery is targeted at what a peer is actually missing rather than a blanket retransmit. If you're used to a reliable-by-default RPC layer, read the reliability and redundancy docs before assuming state "just arrives" — here, arriving is something the system has to actively account for, not a channel guarantee you get for free.

## What Nucleus does not do

Stated up front so it isn't discovered mid-project:

- **No lag compensation or server-side rewind.** There's no world-rewind primitive in the engine to validate a shot against what the shooter saw. (Pieces of this — server-side rewind, lag-compensated queries, projectile catch-up compensation — are planned or partially built; the rewind primitive itself is not.)
- **No matchmaking or lobby service.** Nucleus connects peers; finding and browsing sessions is not in scope.
- **No voice chat.**
- **No WebGL or browser target.** There is no browser-reachable transport.
- **No LAN discovery.**
- **No networked character controller.** Nucleus ships the prediction and physics primitives a controller would be built on, not a ready kinematic controller.

## Where the pieces live

- `Nucleus/` — the engine-agnostic core: systems, components, members, serializers, interest, transports.
- `Nucleus.Integrations.Unity/` — the Unity layer: MonoBehaviours, inspector-facing components, and the demos.
- `Nucleus.Integrations.BlitzRelay/` and `Nucleus.Integrations.Newfarm/` — the other integration layers.
- `Nucleus.Tests/` — the body of runnable, core-only examples. Reading a component or a test here shows working core code with no engine attached.

Across the shipped feature set, that's 289 features across 17 areas, with another 18 planned and 5 archived or deliberately-scoped entries listed alongside them. The "does not do" section above isn't drawn from that list — it's drawn from a separate register, the competitive feature-gap comparison's Declined bucket, 39 of the 85 tracked gaps the project has closed to work on purpose rather than left open by oversight.
