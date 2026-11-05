---
title: "What scales and what does not"
---

> **Driving the core API directly?** See [What scales and what does not](../../core-api/interest/what-scales.md).

## Four ways to send less

From the largest saving to the smallest:

1. **Don't send it.** A condition that vetoes `InterestEffect.Spawn` means the client never holds the object, so nothing is sent at all.
2. **Stop sending it.** `InterestEffect.Stop` pauses updates to a client that keeps the object. It is cheaper than a fresh spawn later, but the object still exists on that client.
3. **Send it less often.** `SendInterval.Normal` sends on every tick the value changed; a wider `SendInterval` collects changes and sends at most once per interval. This applies only under `TransmissionMode.Interval`; a member on `TransmissionMode.Divine` sets its own rate. A spawn, resync, recovery or reconcile always carries the current value, whatever the interval.
4. **Send it smaller.** `TransmissionMode` and per-value compression make each send smaller without removing any.

## Find which cost is too high

"Replication is too expensive" is usually one of three problems, and fixing the wrong one does nothing.

| Cost | What it is | What lowers it |
| --- | --- | --- |
| Per-client egress | Bytes one client's connection sends per second, all the time. | Spawn and stop culling first, then interval and compression. Pacing does not help. |
| Burst size | How much lands in one tick on a join, a scene load, a bundle release, or a client walking back into range. A large tick is costly to lose. | `ServerManager.MaximumObjectKilobytesPerTick` (default 50) spreads new objects over several ticks. It lowers neither the join's total cost nor steady egress, and a join that fits the budget never touches it. |
| Interest evaluation | Server CPU spent deciding who sees what. It grows with the number of objects, clients and rules. | **Evaluation Cadence Ticks** is the only setting. |

## Read the cost before you change anything

Use the bandwidth counters (`TotalBytesSent`, `TotalBytesReceived`, `TotalStatePacketPayloadBitsSent`, `TotalStatePacketPayloadBitsReceived`) and the per-object and state-only statistic rows. Every counter covers a whole peer's traffic, not one object's. A per-object figure is that total divided by the object count; the per-object statistic row does the division for you.

## Don't plan around what Nucleus does not have

- No cap on ordinary traffic. Only new objects are paced, and nothing decides what is sent first when a client is behind.
- No per-object send priority. Every eligible object is served the same way.

## Pro and free differ

Distance and spatial grid culling, level of detail and object pacing (`MaximumObjectKilobytesPerTick`) are Pro. Pro also compresses values more tightly than free. Compression is fixed by the edition that built the peer, and cannot change per world.

## Work out the cost of a small world

Take 50 objects, each with one `NetworkMember` sending a full-precision value every tick at `SendInterval.Normal`, and 20 clients.

- **Egress:** each client receives its own 50-object slice every tick, 1,000 sends per tick across all clients. Per-client egress grows with how many objects that client can see.
- **Evaluation:** at a cadence of 10, a client can see a change in range up to 10 ticks late.
- **Join burst:** a joining client is owed all 50 objects' starting state in one tick. That is far under 50 kB, so pacing never engages.

This world needs none of the levers yet.
