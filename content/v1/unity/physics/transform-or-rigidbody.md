---
title: "NetworkTransform or NetworkRigidbody"
---

## Choose by what a proxy has to do

`NetworkTransform` makes every other peer follow the pose: it applies the received position, rotation and scale one tick behind, and the proxy has no physical motion of its own. `NetworkRigidbody` keeps every peer simulating: each peer's `Rigidbody` steps with real collision response while it is steered toward the server's state.

Use `NetworkTransform` when a proxy only has to look right. It is cheaper and never fights local physics. Use `NetworkRigidbody` when a proxy has to behave right, so other bodies can bump it, land on it or collide with it on every peer.

| Object | Use |
|---|---|
| Player capsules, doors | `NetworkTransform`. Proxies don't need to be bumpable, and following the pose is cheap and smooth. |
| Thrown and bumped bodies, such as a grenade or a kicked prop | `NetworkRigidbody`, so they bounce off geometry the same way for everyone watching. |
| A body its controlling client predicts | Neither. Use a `ValidatedRigidbody`; see [Predicting a body with a validated behaviour](./predicting-a-body-with-a-validated-behaviour.md). |
| Debris nobody steers | `NetworkRigidbody`, or no replication at all if it is not gameplay-relevant. |
| Agents that walk a path | Neither. Use [NetworkNavMeshAgent](./network-nav-mesh-agent.md), which sends the leg being walked. |

## Never put both on one object

`NetworkTransform`'s **Kinematic Management** (on by default) holds an attached `Rigidbody` kinematic on every peer that isn't the controller, including the server while a client controls the object. `NetworkRigidbody` never moves a kinematic body, so on every proxy the body sits where `NetworkTransform` last put it and never collides correctly. Replicate an object's pose through one component only.

## Compare setup and sending cost

`NetworkTransform` needs no physics setup. `NetworkRigidbody` needs a `Rigidbody`, and Nucleus adds the physics driver it runs under; see [Replicate a rigidbody](./replicate-a-rigidbody.md).

Both send through the same per-member `TransmissionMode` choice, `Divine` or `Interval`, with `SendInterval` under `Interval`. `Divine` can go quiet for stretches where `Interval` would still send. It is Pro: a free build sends a `Divine` member as `Interval`. Pro also compresses values more tightly than Free. See [How Often a Member Is Sent](../../core-api/state/send-pacing.md).
