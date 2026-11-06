---
title: "Retention, redundancy and recovery"
---

These `SystemManager` settings trade latency and bandwidth for tolerance to packet loss. Set `StateInterpolation`, `GlobalRedundancy`, `ClientRedundancy` and `StateRetentionMilliseconds` the same on both peers: `StateInterpolation` sets how large a buffer the receiver has, so a mismatch leaves one side planning for recovery the other cannot provide.

## Buffer incoming state with StateInterpolation

`SystemManager.StateInterpolation` is how many ticks a receiver holds a state packet before applying it. `0` applies at once, `1` waits until the next tick, and so on. The maximum is `SystemManager.MaximumStateInterpolation` (`7`); higher values are clamped at runtime.

Each buffered tick adds a tick of delay, and gives late and resent packets more time to arrive. The server's redundant resends and recovery only work within this buffer. A client's upstream resends are the exception (see `ClientRedundancy`).

## Resend state with GlobalRedundancy

`SystemManager.GlobalRedundancy` is how many past ticks of unreliable state every peer resends alongside the current one. At `2`, each tick goes out three times, so a receiver can still apply a tick whose first copies were lost. On the server's sends, values above `StateInterpolation` are clamped, because those copies would arrive too late to apply.

Redundancy only helps on an unreliable channel. Call `SystemManager.CanUseRedundancy()` rather than reading `GlobalRedundancy`: it returns true only when the server's effective redundancy is above zero and the transport's default channel is unreliable.

```csharp
if (systemManager.CanUseRedundancy())
{
    // Safe to plan around redundant resends on this connection.
}
```

## Resend client writes with ClientRedundancy

`SystemManager.ClientRedundancy` (default `3`) is how many extra copies a client adds, on top of `GlobalRedundancy`, to its predicted spawns and its own writes. With the defaults, a client sends each upstream tick four times.

It is not limited by `StateInterpolation`: a copy that arrives too late is discarded and costs only its upstream bytes, while one that arrives during a burst of loss is applied. A host's own client does not use it.

Redundancy is the first defence, not a guarantee. A predicted spawn whose copies are all lost is despawned locally. A client write that still goes missing is recovered (see below).

## A tick missing some packets applies what arrived

A tick too large for one packet is sent as several. With `SystemManager.PartialStateApplyEnabled` on (the default), the receiver applies the packets that arrived, and only what was missing is sent again, starting as soon as the loss is noticed. With it off, the whole tick is discarded and recovered. That costs more under steady loss, and a large world can fall further behind with every attempt.

A tick is still discarded whole when a missing packet carried a change the rest relies on, such as a despawn, a controller change or a reparent.

The setting belongs to the receiver, so the peers do not need to match.

```csharp
// Discard and recover any tick that loses a packet.
coreManager.SystemManager.PartialStateApplyEnabled = false;
```

## A client's own writes always reach the server

Writes to a system a client controls, or has been allowed to write, are recovered however much upstream traffic is lost. Messages and remote calls are not: they may drop. Recovery costs nothing on a link that loses nothing, and `ClientRedundancy` keeps it rare on one that does.

Limits:

- A member the server has written since the client's lost write is not resent, so an older value never overrides the server's newer one.
- A client that may no longer write the system resends nothing for it.
- Nothing older than the retention window can be resent, so a link silent for longer than that loses what it was carrying.

## Keep past state with StateRetentionMilliseconds

`SystemManager.StateRetentionMilliseconds` sets both how much past state is kept for recovery and how long a sent tick may go unacknowledged before recovery escalates. Raise it for high-latency players, so slow acknowledgments are not mistaken for loss.

- Default: `SystemManager.DefaultStateRetentionMilliseconds` (`1000`).
- Maximum: `SystemManager.MaximumStateRetentionMilliseconds` (`2000`). Higher values are capped.
- Changing it at runtime never reallocates.

A longer window gives struggling connections more time to recover, at the cost of a longer wait before a slow but healthy peer would be mistaken for a lossy one. A peer that falls behind by more than the window is sent the whole world it observes again.

## Set them in Unity

`UnitySystemManager` has inspector fields for `GlobalRedundancy` (Global Redundancy), `ClientRedundancy` (Client Redundancy), `StateInterpolation` and `PartialStateApplyEnabled` (Partial State Apply). `StateRetentionMilliseconds` has no inspector field; set it in code.

## Watch for recovery violations

A `RetentionExceededViolation` or `RecoveryUnconfirmedViolation` means the retention or recovery settings are too small for what a connection is experiencing. See [Violation reference](../diagnostics/violation-reference.md).

To check which systems were recently sent, see [Reading serialization history](../diagnostics/inspecting-packets-and-state-history.md).
