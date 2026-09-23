---
title: "Replicate a rigidbody"
---

> **Driving the core API directly?** See [Replicate a physics body](../../core-api/physics/replicate-a-body.md).

Add `ProjectedRigidbody` to a GameObject that has a `Rigidbody`. That's the whole setup.

## What gets added

`ProjectedRigidbody` carries two `[RequireComponent]` attributes, so adding it pulls in the other two components you need:

- **Rigidbody** — the physics body itself. `ProjectedRigidbody` never simulates on its own; it steps and reads Unity's own rigidbody.
- **NetworkSystemObject** — the marker that gets this object a `NetworkSystem` to belong to.
- **ProjectedRigidbody** — the component you actually add, which ties the two together.

You never rent or spawn anything by hand. In its own `Awake`, `ProjectedRigidbody` calls `NetworkSystemObjectPool.RequireSystem<NetworkSystem, NetworkPhysicsComponent>`, declaring that this object needs a system carrying a replicated `NetworkPhysicsComponent`. Once that requirement is satisfied, three properties are populated for you to read:

- `NetworkSystem` — the system this body belongs to; its controller state decides which peer's simulation is treated as ground truth.
- `PhysicsComponent` — the replicated `NetworkPhysicsComponent` this body captures into or converges from.
- `Body` — a `UnityPhysicsBody`, the adapter wrapping your `Rigidbody`.

Nothing else needs wiring. No manual `RequireSystem` call, no manual component lookup.

## Who simulates

Exactly one peer simulates this body for real: the one where `NetworkSystem.IsController(ControllerType.AnyController)` is true. Every tick, that peer's `Rigidbody` steps normally, and the stepped result is captured into `PhysicsComponent` for replication.

Every other peer's `Rigidbody` does not run free simulation. Instead it follows: it adopts the first state it receives outright (so a freshly spawned proxy doesn't glide in from the prefab pose), then either follows the interpolation buffer as a kinematic body (for a proxy driven by a remote controller's own inputs) or runs the convergence follower against the freshest snapshot, projected forward toward present time. The Rigidbody on a non-controlling peer is still a real, simulated body doing collision response — it's being steered toward the server's target, not teleported onto it.

## Smoothing the render without touching physics

`Smoothed Visual` takes a `Transform` detached from the physics body — a child you keep separate from whatever the `Rigidbody` itself carries. It interpolates between the last two stepped poses in `LateUpdate`, hiding tick-rate stepping behind frame-rate rendering. Because it's a detached transform, the physics body's own pose is never touched by this smoothing — nothing here can desync a collision or a captured state.

`Visual Smoothing` (seconds) additionally low-passes that visual toward the interpolated pose, easing out the jitter a correction leaves. Leave it at `0` on a body that should not trail — a fast-falling object that needs its visual pinned exactly to the physics pose.

## Don't also add NetworkTransform

This object replicates its pose through `ProjectedRigidbody`'s own `NetworkPhysicsComponent`. Adding `NetworkTransform` to the same object as well double-replicates the pose through two independent systems. See the transform-replication choosing page for which component fits which object.

A `PhysicsSimulationDriver` present in this body's scene is what puts the body on the tick cadence: it calls the pre- and post-step halves around the world step so capture and follow line up with ticks. You don't have to add one yourself for replication to work — a `UnityPhysicsManager` is added to the manager graph automatically, and without any driver in the scene the body still replicates, just clocked by Unity's own `FixedUpdate` instead of the tick.

## Verifying it

Run two editors. On the controlling peer, move or nudge the `Rigidbody` — push it, let it fall, whatever your scene does. On the second editor, the same `Rigidbody` follows that motion: not by teleporting to each new position, but converging toward it tick by tick.

Before any state has arrived at all, the second editor's copy sits at its prefab pose and does not move — there's nothing to follow yet, so the first received state is what gets adopted outright.
