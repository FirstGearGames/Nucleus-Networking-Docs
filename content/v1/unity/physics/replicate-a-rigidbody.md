---
title: "Replicate a rigidbody"
---

> **Driving the core API directly?** See [Replicate a physics body](../../core-api/physics/replicate-a-body.md).

## Add NetworkRigidbody

1. Add `NetworkRigidbody` to the GameObject. Unity also adds a `Rigidbody` and a `NetworkSystemObject` if the object lacks them.
2. Optional: put the renderer on a child, such as one named `Visual`, and assign it to **Smoothed Visual** so the body draws smoothly between physics steps. Set **Visual Smoothing** if corrections show; leave it at `0` on a body that must not trail, such as a fast-falling object. See [NetworkRigidbody](./network-rigidbody.md).
3. Do not add a `NetworkTransform` to the same object. See [NetworkTransform or NetworkRigidbody](./transform-or-rigidbody.md).

Under the default execution mode, `PhysicsExecutionMode.NucleusPerTick`, you never rent a system or add a physics driver yourself. Under `PhysicsExecutionMode.UnityRun` the default world is left to Unity and projected physics is unavailable there; see [Physics execution modes](./physics-execution-modes.md).

## Only the controlling peer simulates freely

The peer where `NetworkSystem.IsController(ControllerType.AnyController)` is true steps the `Rigidbody` normally and sends the result each tick.

On every other peer, the body appears where the server has it, then follows the server's body while it keeps simulating and colliding. The exception is a body a remote client controls with `RemoteExtrapolationEnabled` off, which follows the received states as a kinematic body; see [Driving a predicted body](./driving-a-predicted-body.md).

## Check it across two editors

1. Run two editors.
2. On the controlling peer, push the `Rigidbody` or let it fall.
3. On the second editor, the same `Rigidbody` converges toward that motion tick by tick rather than teleporting.

Until the first state arrives, the second editor's copy sits at its prefab pose.
