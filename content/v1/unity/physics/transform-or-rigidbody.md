---
title: "NetworkTransform or ProjectedRigidbody"
---

## Two different models

`NetworkTransform` and `ProjectedRigidbody` both replicate a moving object, and they do it in incompatible ways.

`NetworkTransform` makes every non-controlling peer a **pose follower**. The controller writes position, rotation, and scale each tick; every other peer applies the received values onto the transform through the interpolation buffer, animated one tick behind fact. Velocity is never synchronized — a proxy has no physical motion of its own, it is just redrawn along the received path.

`ProjectedRigidbody` keeps every peer **simulating**. The controller's `Rigidbody` steps normally and the stepped result is captured for replication. Every other peer's `Rigidbody` also steps — real collision response, real physics — while the convergence follower (`PhysicsConvergence`) steers it toward the authoritative snapshot, blending a diverged position or rotation back once it passes a threshold instead of teleporting onto it.

Pick by what a proxy needs to do: look right, or behave right. A pose follower is cheaper and never fights local physics. A converging body can be bumped, land on, or collide with on every peer, because it's actually simulating there.

## Never both on one object

Adding both to the same GameObject is not redundant, it's broken. `NetworkTransform`'s Kinematic Management (on by default) holds an attached `Rigidbody` kinematic on every peer that isn't the controller — including the server while a client controls the system — so the interpolated pose writes don't fight local physics. That's exactly the body `ProjectedRigidbody` needs to step.

`PhysicsConvergence.Step` checks `physicsBody.IsKinematic` first and returns immediately if it's true. So on a non-controlling peer with both components: `NetworkTransform` sets the rigidbody kinematic, and `ProjectedRigidbody`'s follower short-circuits on every call and never runs. The body goes inert on every proxy — it sits wherever `NetworkTransform` last interpolated it to, never converging, never colliding correctly.

An object replicates its pose through one system or the other, never both.

## Choosing by object

- **Player capsules, doors** — `NetworkTransform`. The pose is driven by input or a controller, proxies don't need to be physically bumpable, and pose-follow interpolation is cheap and smooth.
- **Thrown and bumped bodies** — `ProjectedRigidbody`. These need to collide correctly on every peer — a thrown grenade or a kicked prop has to bounce off geometry the same way for everyone watching, not just the controller.
- **Debris nobody steers** — `ProjectedRigidbody`, or nothing at all if it never needs to agree across peers. If it's not gameplay-relevant, it may not need replication at all.
- **Agents that walk a path** — neither. See [NetworkNavMeshAgent](../network-nav-mesh-agent) — a path-following agent replicates the leg it's walking, not a per-tick pose or a physics body.

## Cost, in outline

`NetworkTransform` replicates position, rotation, and (optionally) scale as ordinary members. `ProjectedRigidbody` replicates through `NetworkPhysicsComponent`, and additionally spends `PhysicsConvergence.Settings` steering: threshold, blend rate, teleport distance, and the rest, tuned per body rather than sent per tick.

Both go through the same per-member choice of `TransmissionMode` — `Divine` or `Interval` — and, under `Interval`, `SendInterval`. `Divine` can go quiet for stretches where `Interval` would still be sending deltas, at Pro-only cost; Free packs every length exactly, Pro packs more tightly. See [How Often a Member Is Sent](../../core-api/state/send-pacing) for what each mode actually costs and how to choose between them — that decision doesn't differ between the two components.

## Setup cost

A `NetworkTransform` object needs no driver and no `UnityPhysicsManager` decision. It's self-contained: add the component to an object carrying a `NetworkSystemObject`, and it works.

A `ProjectedRigidbody` object needs both a `Rigidbody` and a scene physics story. A `UnityPhysicsManager` is added to the manager graph automatically, and the body will replicate even with no `PhysicsSimulationDriver` in the scene — clocked by Unity's own `FixedUpdate` instead of the tick. Adding a driver puts capture and follow on the tick cadence instead, which is the setup most projects want once physics replication matters. See [PhysicsSimulationDriver](../physics-simulation-driver) and [Replicate a rigidbody](./replicate-a-rigidbody).
