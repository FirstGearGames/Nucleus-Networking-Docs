---
title: "How physics replication works"
---

## The controller captures and every other peer follows

The peer that controls a body simulates it normally and, once per tick, captures its world position, world rotation and condition flags into ordinary members of a [NetworkPhysicsComponent](./network-physics-component.md), along with the tick of the capture. A resting body sends no new updates.

Every other peer keeps simulating its own copy of the body through the same physics engine. Each physics step, a [PhysicsConvergence](./physics-convergence.md) steers that copy toward the server's state. Because every peer really simulates the body, contacts, stacks and collisions stay real everywhere.

Position and rotation use Divine or Interval transmission like any other member. Divine is Pro: a free build accepts `Divine` and replicates the member as `Interval` does.

## The core never sees an engine type

The replicated members and snapshots use `System.Numerics` `Vector3` and `Quaternion`, so the core depends on no physics engine. An integration reads its engine's body into that shape and writes the result back; see [Adapting your engine](./adapting-your-engine.md). Nucleus ships a Unity integration that does this for Unity's physics.

## Some things are not built in

- **Replay-correct collision callbacks** are not provided. A converged body is never rewound. An integration can still step its physics world on each replayed tick through `SystemManager.ReplayEarlyFixedUpdated`; the Unity integration does, and rewinds only the bodies its validated behaviours predict (see [Predicting a body with a validated behaviour](../../unity/physics/predicting-a-body-with-a-validated-behaviour.md)).
- **Judging a shot against where targets were** is [lag compensation](../lag-compensation/how-lag-compensation-works.md) (Pro), which keeps its own hitbox history and does not touch physics bodies.
- **Catching a freshly spawned projectile up through the latency it lost** is [spawn compensation](../systems/spawn-compensation.md) (Pro).
