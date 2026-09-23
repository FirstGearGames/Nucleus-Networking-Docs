---
title: "How a Value Reaches the Wire"
---

> New to Nucleus? Start with [How replication works](../../start-here/how-replication-works.md) first — this page assumes you already have the pipeline overview and goes one level deeper, into the encoding itself.

Setup: [Reference the source generator](../../start-here/adding-nucleus-to-a-dotnet-project.md) (plain .NET) or [Installing the Unity integration](../../start-here/installing-the-unity-integration.md) (Unity).

## The path, end to end

A `NetworkMember<T0>`'s `Value` setter is the start of the path. It mutates the member's live ring slot and notifies the owning system that something changed — nothing is written yet.

At serialize time, the component's generated writer encodes each changed member against the shared baseline both peers hold, producing a delta payload. That payload becomes the body of a framed subpacket: a `StatePacketType` (`Delta`, `Full`, `Controller`, and the rest), the subpacket's bit length, then the body. Multiple kinds get packed into one combined stream for the tick this way — a spawn, a controller change, and a batch of deltas can all ride together.

`PacketSegmentWriter` takes that combined stream and fits it into one or more `StatePacket`s, splitting at the maximum transmission unit when the tick's data doesn't fit in one. Each `StatePacket` carries a `SegmentNumber` and `ExpectedSegmentCount` so the receiver can rejoin a tick's segments before demuxing the frames inside. The segmented packets are then handed to the transport for the peer.

On the receiving end this runs in reverse: rejoin segments into one reader, walk the frames in order (`Full`, then `Controller`, then `Delta` — so a spawn exists before anything addresses it), and each component's generated reader decodes its members back out.

## Bits, not bytes

Values are packed at bit granularity, not byte granularity. A member carries a length indicator alongside its data, so the wire cost of "a float" or "a Vector3" has no fixed answer — it depends on how far the value moved since the last tick it was sent. A value that barely changed writes short; one that changed a lot writes long. (How that length indicator itself is encoded isn't covered here — the granularity and the cost trade-off are what matter at this level.)

## Nothing reflective at runtime

Every `Write`/`Read` method your components use is emitted by the Nucleus source generator at build time, and each one registers itself at assembly load through a module initializer. There is no reflection-based serialization path, and no runtime type inspection to find or build a serializer — a type either has generated code for it or it doesn't compile against the network path. That's what keeps the engine AOT-friendly: nothing here depends on `System.Reflection.Emit` or similar runtime code generation that AOT platforms disallow.

## Three things you can tune

- **Compression level and accuracy — how tightly.** `CompressionLevel` (`Tight` by default, or `Aggressive`) is fixed at a `NetworkMember<T0>`'s construction. `Accuracy` sets the wire accuracy used for delta encoding, loss recovery, and lossy serialization; it defaults per-type (tighter for a `Quaternion` than a general float) and can be coarsened for a value that tolerates more error, like a velocity.
- **Transmission mode and send interval — how often, or whether at all.** `TransmissionMode.Interval` (the default) sends ordinary deltas paced to a `SendInterval`; `SendInterval.Normal` sends every changed tick, and a wider interval accumulates changes and rides at most one delta per span. `TransmissionMode.Divine` projects the value instead of sending ordinary deltas, correcting only when needed, so it can go quiet for stretches where `Interval` would still be sending — the mechanism itself isn't something you need to reason about to use it, and it is Pro-only.
- **`[ReplicationIgnore]` — whether the code exists at all.** A member declared with `ReplicationIgnoreAttribute` gets no generated serialization: the generator skips it entirely rather than serializing-and-discarding it, so it's not a runtime cost you pay and choose not to use — it's code that was never emitted.

## Unreliable-first

Most state rides an unreliable channel. Correctness doesn't come from retransmitting a lost packet — it comes from acknowledgment, redundant resends, and targeted recovery for a peer that's fallen behind. See the reliability and recovery section for how that works; this page only needs you to know that "unreliable" is the normal case for state, not an edge case to work around.

## Glossary

- **Full** — a complete serialization of every member, used for spawns and resyncs. Reconstructs a system from nothing.
- **Delta** — a member encoded against the shared baseline, carrying only what changed.
- **Baseline** — the last value both peers agree the member held, which a delta is encoded relative to.
- **Framed subpacket** — a `StatePacketType`, its bit length, then its body; the unit the combined per-tick stream is built from.
- **Segment** — one `StatePacket` produced by splitting the tick's combined stream to fit the maximum transmission unit.
- **Bundle id** — part of how a spawned system's type is addressed on the wire; not explained further here.
- **Projection** — the mechanism behind `TransmissionMode.Divine`: a value rides a predicted path between corrections instead of being resent every interval.
