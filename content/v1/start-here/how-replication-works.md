---
title: "How replication works"
---

## The tick

Nucleus advances in fixed steps, not whenever a script happens to run. Every tick invokes twelve named steps in the same order: `EarlyVariableUpdate`, `EarlyTickUpdate`, `EarlyStateUpdate`, `LateStateUpdate`, `Reconcile`, `EarlyFixedUpdate`, `LateFixedUpdate`, `VariableUpdate`, `EarlyStateWrite`, `LateStateWrite`, `LateTickUpdate`, `LateVariableUpdate`.

That fixed order is what lets two independent peers agree on what happened and when. If game code could read or write networked state at an arbitrary point in a frame, a server and a client would each be comparing values captured at different, unpredictable moments. Instead, every peer applies incoming state at the same step, lets game code run in between, and writes outgoing state at the same later step. Everyone changes state on the same beat.

Two steps matter most for replication: `EarlyStateWrite`, where game code sets a networked value, and `LateStateUpdate`, earlier in the same tick, where values received from the network are applied. Because the apply step runs before the write step, a peer sees the world update before its own game code for that tick runs.

## The journey of one value

Take a single networked member, declared on a component:

```csharp
public partial class DemoScoreComponent : NetworkComponent
{
    public readonly NetworkMember<int> Score = new();
}
```

One trip across the network looks like this:

1. **Written on the authority.** The peer that owns the object and decides its truth (the authority, usually the server) sets `Score.Value` during `EarlyStateWrite`. `NetworkMember<T0>.Value` is the current value; setting it also rotates the value ring so the value it replaces becomes readable as `PreviousValue`.
2. **Change detection notices it.** A member does not serialize just because it exists. Setting `Value` flags the member as changed for this tick, and only changed members are considered for sending.
3. **Serialized during the tick's write steps.** During `LateStateWrite`, the framework walks every system with changed members and serializes them.
4. **Travels as part of one combined packet.** Nucleus does not send one packet per member or per component. A tick's outgoing state for a connection is written into a single combined stream, flushed to the transport at `LateVariableUpdate`.
5. **Applied on the receiver before that peer's own tick work runs.** The receiving peer reads and deserializes incoming packets early (`EarlyVariableUpdate`), then applies the contained state during `LateStateUpdate` — both steps ahead of `EarlyFixedUpdate`, `VariableUpdate`, and that peer's own `EarlyStateWrite`. Game code on the receiver reading `Score.Value` during its own tick sees the value the authority wrote, not something stale from before the packet arrived.

## Snapshot, then delta

A peer that has never seen a system before cannot make sense of a partial update, so the first thing it receives is a full snapshot of every member's value. Every tick after that carries only what changed: a delta.

This is why `NetworkMember<T0>` exposes both `Value` and `PreviousValue`. A delta encodes against the previous value already held on both ends rather than restating the whole thing, which is cheaper the more ticks a value has been streaming. The moment a peer starts observing a system — joining, a scene load, an object first coming into range — it gets a full again, because there is no previous value on that peer's side yet to delta against.

## Interpolation: correct, a little old, on purpose

A receiving peer does not render the newest value the instant it applies. `NetworkMember<T0>.InterpolatedValue` sweeps from `PreviousValue` to `Value` across the member's send interval rather than jumping the moment a new value lands. If you read `InterpolatedValue` on a peer that does not control the object, you are looking at a value that is deliberately a little behind the true, just-applied one — buffered and played back smoothly instead of popping between sparse updates. `Value` itself is never delayed; only the interpolated read is.

`SystemManager.StateInterpolation` sets how many ticks of buffer a peer holds before it starts applying received state at all, trading a little more latency for smoother arrivals when packets don't land on a perfectly even cadence.

## When a packet doesn't arrive

Loss recovery here is not a reliable channel retransmitting a dropped packet. There is no such channel underneath state replication. Instead:

- Every outbound packet carries an acknowledgment in its header: the highest tick the receiver has fully applied. Acks only move forward.
- `SystemManager.Redundancy` lets an unreliable state tick resend itself on the following ticks, so a single lost packet is often covered by a later one that repeats the same change.
- When the gap between the last acknowledged tick and the current one grows too wide, the sender re-serves specifically the components that never landed, rather than resending everything or waiting on a generic retransmit.

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
- Delta and full encoding, compression, and accuracy: the serialization reference.
- Interpolation windows, snap thresholds, and send intervals: the `NetworkMember` reference.
- Redundancy, interpolation depth, and retention tuning: the `SystemManager` reference.
- Acknowledgment, redundancy, and targeted recovery in full: the reliability and loss recovery reference.
- Interest and observation rules: the interest system reference.
- Write access and multi-writer systems: the write access reference.
