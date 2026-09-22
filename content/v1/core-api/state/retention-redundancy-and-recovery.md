---
title: "Retention, redundancy and recovery"
---

## The interpolation ceiling

`SystemManager.StateInterpolation` sets how many ticks the receiver buffers a state packet before applying it. `0` applies immediately; `1` holds a packet until the next tick before applying; and so on. It is capped at `SystemManager.MaximumStateInterpolation` (`7`) — a higher value is silently clamped at runtime.

This value is the ceiling for everything else on this page. Redundant resends and recovery only work within the window the receiver is already buffering, so both `Redundancy` and the interpolation itself are bounded by it.

## Redundancy

`SystemManager.Redundancy` is how many past serializations of each unreliable state packet to resend alongside the current one. A value of `N` retransmits each tick's unreliable packets on the following `N` ticks — a value of `2` puts 3 copies of every tick on the wire (the current send plus 2 redundant resends), so the receiver can recover a tick whose earlier copies were lost.

Each redundant copy arrives one tick later than the last, so a value larger than `StateInterpolation` would resend copies that always arrive too late to apply. The engine clamps for this automatically.

Redundancy only matters on an unreliable channel — a reliable one already guarantees delivery, so resending is wasted bandwidth. Check `SystemManager.CanUseRedundancy()` rather than reading `Redundancy` directly: it reports true only when the effective redundancy is above zero *and* the transport's default channel is unreliable.

```csharp
if (systemManager.CanUseRedundancy())
{
    // Safe to plan around redundant resends on this connection.
}
```

## Retention

`SystemManager.StateRetentionMilliseconds` governs two things at once: how much past state is kept for targeted recovery, and how long a sent state tick may go unacknowledged before recovery escalates. Raise it for high-latency audiences — every recovery threshold derives from it, so a peer whose acknowledgments simply travel slowly is never mistaken for one that lost data.

- `SystemManager.DefaultStateRetentionMilliseconds` is `1000`.
- `SystemManager.MaximumStateRetentionMilliseconds` is `2000` — higher values are silently capped.
- The history ring is allocated at the maximum up front, so changing `StateRetentionMilliseconds` at runtime never triggers a reallocation.

A peer whose acknowledged tick has aged past the full retention window can no longer be recovered per-system, and is instead re-served the world it observes.

## Setting them, and setting them together

Set `StateInterpolation`, `Redundancy`, and `StateRetentionMilliseconds` the same on both peers. Interpolation determines how large a buffer the receiver actually has, so a mismatch means one side is budgeting for recovery capacity the other side isn't providing.

A deeper `StateInterpolation` (and the `Redundancy` it permits) buys more loss tolerance — more room for a redundant resend to land, more ticks a late packet can still be applied within. It costs latency directly: every buffered tick is a tick of delay before state is applied. A longer `StateRetentionMilliseconds` buys a wider recovery window on struggling connections, at the cost of a larger history ring (fixed at the maximum) and a longer tail before a slow-but-healthy peer would be mistaken for a lossy one.

## Member-granular repair

When a component needs a targeted recovery serve, the engine checks `NetworkComponent.IsMemberRecoverySupported`. A component that overrides this to `true` also overrides:

```csharp
public virtual void WriteRecovery(Writer writer, ulong memberMask) { }
public virtual void ReadRecovery(Reader reader) { }
```

`WriteRecovery` serializes only the flagged members named by `memberMask`; `ReadRecovery` reads that mask back and applies just those members. Whether a component type supports member recovery is the component type's own choice, and it must be identical on both peers — `IsMemberRecoverySupported` isn't negotiated over the wire.

A component that does not support member recovery (the base `IsMemberRecoverySupported` is `false`) is re-served whole through its ordinary `Write` instead of a targeted recovery.

## Diagnostic reads

Four members on `SystemManager` let you inspect what's actually in the serialization history, independent of any recovery in progress:

| Member | Reports |
|---|---|
| `SerializationHistoryTickCount` | How many ticks of serialization history are currently retained. |
| `IsSystemRecentlySerialized(uint systemId)` | Whether a given system was locally serialized as changed or spawned within the recent history window. |
| `GetRecentlySerializedSystemIds(HashSet<uint> collectedSystemIds)` | Adds the Id of every system locally serialized as changed or spawned within the recent history window. |
| `GetSerializedSystemIdsAfterTick(uint afterTick, HashSet<uint> collectedSystemIds)` | Adds the Id of every system serialized after a baseline tick; returns false if part of the requested range has already aged out of the history window. |

```csharp
using HashSet<uint> changedSystemIds = HashSetPool<uint>.Get();

systemManager.GetRecentlySerializedSystemIds(changedSystemIds);
```

## When it isn't working

See the Diagnostics page for what a `RetentionExceededViolation` or a `RecoveryUnconfirmedViolation` means when one is raised — they're the signal that retention or recovery settings are undersized for what a connection is actually experiencing.

In the Unity inspector, `UnitySystemManager` exposes `Redundancy` and `StateInterpolation` as fields. `StateRetentionMilliseconds` has no inspector field; set it in code.
