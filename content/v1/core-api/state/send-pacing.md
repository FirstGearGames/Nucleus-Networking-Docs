---
title: "How Often a Member Is Sent"
---

## Choose Interval or Divine

A `NetworkMember<T0>` uses one `TransmissionMode`, never both:

- `Interval` (default): sends changes paced to the member's `SendInterval`.
- `Divine` (Pro): for values that tend to move predictably, such as a moving transform. It can stay quiet where `Interval` would keep sending, and corrects only when needed. It ignores `SendInterval`.

Pick `Divine` for a value that moves smoothly, `Interval` otherwise.

## Choose a send interval

`SendInterval` names a span rather than a tick count, so its meaning does not change with the tick rate:

- `Normal` (default): every tick the value changed.
- `Short`: at most every 250 ms.
- `Long`: at most once a second.

Choose `Short` for a value that needs to look live, and `Long` for one that only needs to be right before long.

`SendIntervalTicks.Resolve(SendInterval, uint)` converts a span to ticks for a tick rate. It rounds up, so a rate that does not divide the span evenly adds at most one tick of latency rather than sending faster than asked. `Normal` always resolves to one tick.

Pacing never loses a value. A member that changes several times within its interval sends its latest value on the next due tick, and a member that stops changing still sends its final value. A spawn, resync, recovery or reconcile always delivers the current value.

```csharp
// Interval-paced, at most one update every 250ms.
NetworkMember<float> health = new(sendInterval: SendInterval.Short);

// Divine projection; sendInterval is ignored while this mode is set.
NetworkMember<Vector3> position = new(transmissionMode: TransmissionMode.Divine);
```

The interval applies the same way to every observer. No interval scales with distance or anything else.

## Choose what silence means

`isExtrapolationEnabled` applies in both modes:

- `true` (default): receivers keep the value moving through the sender's silence. A lost update can cause a brief overshoot.
- `false`: receivers hold still until told. A lost update can cause a brief stall.

Start with `true`, and set it to `false` if a lost update visibly overshoots.

Under `Interval`, `true` lets a receiver render up to one send interval ahead of the newest value while it moves, and the sender sends one small extra update when the value stops so receivers settle exactly on it. That costs a tiny overhead on each update plus one update per stop. `false` costs nothing extra, and the receiver never renders past the newest value.

## Receivers follow the sender's settings

`TransmissionMode` and `isExtrapolationEnabled` are construction defaults that you can override per instance at runtime. A receiver adopts the sender's mode and extrapolation setting, so the peers do not need to be built with the same values. Set each once rather than changing it mid-stream.

## Free builds send every changed tick

`Divine`, `Short` and `Long` are Pro. They compile in Free but change nothing there: `Divine` replicates as `Interval` does, and every span resolves to one tick, which is what `Normal` means. One prefab therefore loads in either edition without `#if` around its members.
