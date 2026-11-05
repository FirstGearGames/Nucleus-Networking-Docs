---
title: "NetworkTransform"
---

> **Driving the core API directly?** See [TransformComponent](../../core-api/state/transform-component.md).

`NetworkTransform` replicates a GameObject's position, rotation and scale from the controller to every other peer. Add it to a networked object, on the GameObject that carries the `NetworkSystemObject` or on a child of it. It belongs to the nearest `NetworkSystemObject` at or above it; with none there it never gets a system. To catch that, open the Nucleus window (**Tools > Nucleus**), select the **Build** tab and click **Validate** next to **Validate Network Prefabs**.

The controller's pose is captured on the `EarlySerialize` step, just before the tick is sent. Every other peer follows that pose smoothly, slightly behind.

## Configure it in the inspector

| Field | Default | Effect |
|---|---|---|
| Transforms | empty | The transforms to replicate, all on one system. Empty replicates the component's own GameObject. See [Replicate several parts with one NetworkTransform](#replicate-several-parts-with-one-networktransform). |
| Transform Space | `Local` | Which space the pose replicates in. See [Choose the transform space](#choose-the-transform-space). |
| Interpolate Scale Enabled | `true` | Interpolates the replicated scale on non-controllers. Off, local scale is left as it is. |
| Kinematic Management Enabled | `true` | Holds an attached `Rigidbody` kinematic on every peer that is not the controller, including the server while a client controls the system, so local physics cannot fight the replicated pose. The controller's body is returned to simulation. Turn it off when other code owns the body's kinematic state. |
| Send Interval | `Normal` | Paces replication while Transmission Mode is `Interval`. No effect under `Divine`. |
| Transmission Mode | `TransmissionModeDefaults.Motion` | Applied to position, rotation and scale. Resolves to `Divine` where a projector is registered, `Interval` otherwise. |
| Extrapolation Enabled | `true` | Keeps the object moving on other peers through the sender's silence, under either mode. A lost update is then covered by motion but can briefly overshoot; turn it off if that is visible, and the object holds still until told instead. Under `Interval` it costs a little extra bandwidth. See [How often a member is sent](../../core-api/state/send-pacing.md). |

Transforms and Transform Space cannot change during play.

## Choose the transform space

The space is fixed for the object's life.

- **`TransformSpace.Local`** (default) uses a `UnityLocalTransformComponent`, which replicates `Transform.localPosition` and `Transform.localRotation`. An object that stays put inside a moving parent sends nothing. The parent must be replicated too, so both peers measure the offset from the same frame. On a reparent the object keeps its local offset inside the new parent (`IsWorldPoseKeptOnReparent` is `false`).
- **`TransformSpace.World`** uses a `UnityWorldTransformComponent`, which replicates `Transform.position` and `Transform.rotation`. Use it when the object can hang from something that is not replicated, such as a client-local rig. A reparent moves nothing (`IsWorldPoseKeptOnReparent` is `true`), but a carried object sends its pose every tick it rides, even while still relative to its carrier.

## Replicate several parts with one NetworkTransform

For an object with several moving pieces, such as a turret and its barrel, list the pieces in **Transforms** on one `NetworkTransform`. They replicate on one system with one controller and one spawn, share the component's settings, and moving one piece sends only that piece. When the parts share settings, this costs less to send than one `NetworkTransform` per part.

- Keep the list on the prefab, not edited per instance: entry *i* is matched to the same entry on every peer by its position in the list.
- Every entry must sit at or below the object's `NetworkSystemObject`. Null entries are skipped.
- A list longer than `NetworkSystem.MaximumComponentCount` (31) is refused with an error.

To give a part its own settings, put a separate `NetworkTransform` directly on the child. It joins the nearest `NetworkSystemObject` above it. Do not add a second `NetworkSystemObject` to the child: only a prefab's root one is spawned.

## Use NetworkRigidbody for a simulated body

`NetworkTransform` makes non-controllers follow a received pose; it does not run local physics on them. For a rigidbody that should simulate locally on every peer and converge toward the server's state, use `NetworkRigidbody`.
