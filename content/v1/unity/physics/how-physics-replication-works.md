---
title: "How physics replication works"
---

> **Driving the core API directly?** See [How physics replication works](../../core-api/physics/how-physics-replication-works.md).

## Every peer keeps simulating the body

The peer that controls a body simulates it and sends the result each tick. Every other peer keeps simulating its own copy and steers it toward the server's latest state, carried forward to the present, instead of teleporting it there. Contacts, stacks and collisions involving the body stay real on every peer.

## A replay rewinds only predicted bodies

When a client is corrected for an object it predicts, it replays every tick since the one that went wrong, and each replayed tick steps the whole physics world, 3D and 2D. Only a body predicted through a validated behaviour, such as `ValidatedRigidbody`, is put back to the server's values and stepped again. A `NetworkRigidbody` body is not rewound; its `ReplayHeldBody` holds it still for the replay. See [NetworkRigidbody](./network-rigidbody.md) and [Predicting a body with a validated behaviour](./predicting-a-body-with-a-validated-behaviour.md).

## Some things are not built

- Collision callbacks are not replay-correct.
- Judging a shot against where targets were is [lag compensation](../lag-compensation/how-lag-compensation-works.md) (Pro). It keeps its own hitbox history and does not touch physics bodies.
- Catching a freshly spawned projectile up through the latency it lost is [spawn compensation](../../core-api/systems/spawn-compensation.md) (Pro).
