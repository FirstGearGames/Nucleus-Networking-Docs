---
title: "How replication works"
---

## The tick

Nucleus advances in fixed steps, not whenever a script happens to run. Every tick invokes eleven named steps in the same order: `EarlyVariableUpdate`, `EarlyStateUpdate`, `LateStateUpdate`, `Reconcile`, `EarlyFixedUpdate`, `LateFixedUpdate`, `VariableUpdate`, `EarlySerialize`, `LateSerialize`, `TickAdvance`, `LateVariableUpdate`. The tick advances last, at the end of `TickAdvance`.

That fixed order is what lets two independent peers agree on what happened and when. If game code could read or set member values at an arbitrary point in a frame, a server and a client would each be comparing values captured at different, unpredictable moments. Instead, every peer applies incoming state at the same step, lets game code run in between, and writes outgoing state at the same later step. Every peer's values change on the same beat.

Two steps matter most for replication: `EarlySerialize`, where game code sets a networked value, and `LateStateUpdate`, earlier in the same tick, where values received from the network are applied. Because the apply step runs before the write step, a peer sees the world update before its own game code for that tick runs.

## The journey of one value

Take a single networked member, declared on a component:

```csharp
public partial class DemoScoreComponent : NetworkComponent
{
    public readonly NetworkMember<int> Score = new();
}
```

One trip across the network looks like this:

1. **Written on the server.** The peer that owns the object and decides its truth (the server, usually the server) sets `Score.Value` during `EarlySerialize`. `NetworkMember<T0>.Value` is the current value; the value it replaces becomes readable as `PreviousValue`.
2. **Change detection notices it.** A member does not serialize just because it exists. Setting `Value` flags the member as changed for this tick, and only changed members are considered for sending.
3. **Sent during the tick's serialize steps.** During `LateSerialize`, the framework sends every system with changed members.
4. **Applied on the receiver before that peer's own tick work runs.** The receiving peer reads and deserializes incoming packets early (`EarlyVariableUpdate`), then applies the contained state during `LateStateUpdate`. Both steps come ahead of `EarlyFixedUpdate`, `VariableUpdate`, and that peer's own `EarlySerialize`. Game code on the receiver reading `Score.Value` during its own tick sees the value the server wrote, not something stale from before the packet arrived.

A peer that starts observing a system later, by joining, loading a scene or bringing an object into range, receives every member's current value first, not only the changes that follow.

## Interpolation: correct, a little old

A receiving peer does not render the newest value the instant it applies. `NetworkMember<T0>.InterpolatedValue` sweeps from `PreviousValue` to `Value` across the member's send interval rather than jumping the moment a new value lands. If you read `InterpolatedValue` on a peer that does not control the object, you are looking at a value a little behind the just-applied one, played back smoothly instead of popping between sparse updates. `Value` itself is never delayed; only the interpolated read is.

`SystemManager.StateInterpolation` sets how many ticks a peer waits before it starts applying received state at all, trading a little more latency for smoother arrivals when packets don't land on a perfectly even cadence.

## When a packet doesn't arrive

Loss recovery here is not a reliable channel retransmitting a dropped packet. There is no such channel underneath state replication. Instead:

- `SystemManager.GlobalRedundancy` lets an unreliable state tick resend itself on the following ticks, so a single lost packet is often covered by a later one that repeats the same change.
- When state goes missing, the sender re-serves specifically the components that never landed, rather than resending everything or waiting on a generic retransmit.

The effect is that a lost packet is repaired by the next relevant state, not by a transport-level resend of the exact bytes that went missing.

## The three gates on whether a peer sees a value at all

A member existing and changing is not enough for a given peer to receive it. Three separate questions decide that, for each system and each connection:

- **Is the system started?** An unstarted system has nothing to serialize or apply.
- **Does that peer observe it?** A peer only receives state for systems it is currently observing; state for a system outside a peer's interest is not sent to it.
- **Is that peer allowed to write it?** Only a peer with write access to a member's system has its writes accepted and forwarded to everyone else; an unpermitted write does not propagate.

All three are evaluated per connection, so the same system can be visible and writable to one peer while being invisible to another.

## Where each step is documented

This page is the map, not the manual for any one stop on it:

- The full ordering and per-step framework work: the tick pipeline reference.
- Compression and accuracy: the serialization reference.
- Interpolation windows, snap thresholds, and send intervals: the `NetworkMember` reference.
- Redundancy, interpolation depth, and retention tuning: the `SystemManager` reference.
- Acknowledgment, redundancy, and targeted recovery in full: the reliability and loss recovery reference.
- Interest and observation rules: the interest system reference.
- Write access and multi-writer systems: the write access reference.
