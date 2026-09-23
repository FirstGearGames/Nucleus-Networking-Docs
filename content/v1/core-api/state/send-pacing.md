---
title: "How Often a Member Is Sent"
---

## Interval or Divine, not both

A `NetworkMember<T0>` picks a `TransmissionMode`: `Interval` or `Divine`. Projection and pacing are alternative rate strategies for the same job, deciding how often a value is worth putting on the wire, so a member is either projected or interval-paced, never both. That is why `TransmissionMode` is one enum rather than two independent switches: there is no state where both a send interval and a projected path apply at once.

`Interval` encodes ordinary deltas paced to the member's `SendInterval`. `Divine` is a Pro-only alternative for values whose motion tends to be predictable (a moving transform, for example): it can go quiet for stretches where a plain interval would still be sending deltas, correcting only when needed. A member built with `Divine` ignores its send interval entirely; the field is meaningless once the mode isn't `Interval`. The mechanism itself isn't something you need to reason about to use it — pick `Divine` for a value that tends to move smoothly, `Interval` otherwise.

## The three spans

`SendInterval` has exactly three values, named by the span they cover rather than by a tick count, so the meaning doesn't move when the tick rate changes:

- `Normal` — a delta on every tick the value changed. The default, and the only interval a free build actually paces to.
- `Short` — a delta at most every 250ms.
- `Long` — a delta at most once a second.

`SendIntervalTicks.Resolve(SendInterval, uint)` turns a span into a tick count for a given tick rate. It rounds up, never down, so a rate that doesn't divide the span evenly costs at most one tick of extra latency rather than quietly pacing faster than asked. `Normal` always resolves to a single tick.

Two paced tiers, not a ladder. A third tier between `Short` and `Long` would sit close enough to both to be chosen by guesswork, and every extra tier costs a population of members whose sends have to be kept off the other tiers' ticks. `Short` and `Long` are far enough apart that the real choice is between them: does this value need to look live, or only to be right before long.

Pacing never loses a value. A member that changes several times inside its interval rides its latest value on the next due tick, and a member that stops changing still rides its final delta on its next due tick. Full serializations — spawn, resync, recovery, reconcile — always carry the current value regardless of what the interval says.

```csharp
// Interval-paced, at most one delta every 250ms.
NetworkMember<float> health = new(sendInterval: SendInterval.Short);

// Divine projection; sendInterval is ignored while this mode is set.
NetworkMember<Vector3> position = new(transmissionMode: TransmissionMode.Divine);
```

## PathContinuation

Under `TransmissionMode.Divine`, `PathContinuation` is a second setting you choose: `Implied` (the default) or `Announced`. The two trade off differently when a packet is lost — `Implied` favors staying live at the risk of a brief overshoot, `Announced` favors staying accurate at the risk of a brief stall. Try `Implied` first; reach for `Announced` if a lost packet is visibly overshooting for your use case. `PathContinuation` only matters under `Divine` — `TransmissionMode.Interval` ignores it.

## A receiver doesn't need to match

Both `TransmissionMode` and `PathContinuation` are construction defaults, optionally overridden per instance at runtime. A receiver doesn't need to be built with the same values: every full serialization carries the sender's mode and path continuation, and the receiver adopts them automatically. Nothing here has to be toggled in lockstep ahead of time.

## Pro gating

`Divine` and every `SendInterval` above `Normal` are Pro, and both are gated the same way. They compile fine in a free build, because an enum can't be split by edition, so the values stay declared, but they change nothing there. A member set to `TransmissionMode.Divine` replicates with ordinary deltas, as `Interval` does. `SendInterval.Short` and `SendInterval.Long` pace nothing: free resolves every span to a single tick and replicates every changed tick, which is what `Normal` already means. That's what lets one prefab load in either edition without a `#if` around every member declaration.

## Interval and interpolation

A paced member's interpolation window is its resolved send interval, not a fixed constant. A member sent every tick animates across that single tick; a member paced to `Short` or `Long` animates its arrival across exactly the span it was sent on. The receiver never has to be told the window separately, because both peers construct the member with the same interval — it's part of the component's field declaration — so the span is already known on both ends.

## No distance-driven tier

`SendInterval` declares only `Normal`, `Short`, and `Long`. There is no tier that scales with distance to an observer or with anything else; the three spans are the whole set, chosen once per member and resolved the same way for every observer.
