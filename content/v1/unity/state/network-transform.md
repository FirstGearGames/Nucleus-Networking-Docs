---
title: "NetworkTransform"
---

> **Driving the core API directly?** See [TransformComponent](../../core-api/state/transform-component).

`NetworkTransform` replicates a GameObject's position, rotation, and scale. Add it to an object that also carries a `NetworkSystemObject` (it requires one) and the controller's transform replicates to every other peer.

The controller's pose is sampled just before serialization, on the `EarlyStateWrite` loop step, so it does not matter what order your own scripts run in relative to it — the capture always happens right before the tick's state goes out, not whenever some earlier `Update` left the transform. A non-controller never drives the transform: it is a pose follower, animated between the last two received values through the interpolation buffer. Velocity is not replicated.

## Inspector Fields

| Field | Default | Effect |
|---|---|---|
| Transform Space | `Local` | Which space the pose replicates in. See below. |
| Interpolate Scale Enabled | `true` | Interpolates the replicated scale on non-controllers alongside position and rotation. Disabled, local scale is left alone. |
| Kinematic Management Enabled | `true` | Holds an attached `Rigidbody` kinematic on every non-controlling peer, including the server while a client controls the system, and returns it to simulation on the controller. |
| Send Interval | `Normal` | Paces ordinary delta replication while Transmission Mode is `Interval`. Has no effect on a projecting (`Divine`) member — a projected path already streams and smooths on its own. |
| Transmission Mode | `TransmissionModeDefaults.Motion` | The replication strategy applied to position, rotation, and scale on bind. Resolves to `Divine` projection where a projector is registered, `Interval` otherwise. |
| Path Continuation | `Implied` | What silence means while a member projects. Has no effect under `Interval`. |

Transmission Mode, Path Continuation, and Send Interval are pushed onto the underlying `UnityTransformComponentBase` on bind (`SetTransmissionMode`, `SetPathContinuation`, `SetSendInterval`), so a pooled instance re-applies the same authored values on every reuse. Interpolate Scale Enabled and Kinematic Management Enabled stay on `NetworkTransform` itself and are read directly each step, not pushed to the component. Transform Space is spent earlier still, once in `Awake`, before any bind happens.

## Transform Space

`TransformSpace` is read once, when the component declares its requirement, and fixes which transform component type the object's `NetworkSystem` carries for the rest of its life:

- **`TransformSpace.Local`** (default) — the system carries a `UnityLocalTransformComponent`, which replicates `Transform.localPosition` and `Transform.localRotation`. A carried object rides for free: as long as it stays where it was inside its parent, its own replication stays silent no matter how far the parent travels. This requires the parent to be replicated too, since an offset only means the same thing on both peers if they agree on the frame it's measured against. A reparent carries the local values straight through the move — the object lands at the same offset, now measured inside the new parent, so the replicated numbers never jump (`IsWorldPoseKeptOnReparent` is `false`).
- **`TransformSpace.World`** — the system carries a `UnityWorldTransformComponent`, which replicates `Transform.position` and `Transform.rotation`. The pose means the same thing on every peer regardless of what the object is parented to, so use it when an object can hang from something that isn't itself replicated (a client-local rig, a per-peer presentation root). A reparent moves nothing (`IsWorldPoseKeptOnReparent` is `true`); the cost is that a carried object pays full pose replication for as long as it rides, since its world pose changes every tick even while it sits still relative to its carrier.

Both peers instantiate the same prefab, so they always agree on which space an object uses — the choice is part of the system's identity on the wire, not something that could drift between peers.

## Kinematic Management

With Kinematic Management Enabled on, an attached `Rigidbody` is held kinematic on every peer that is not the controller — including the server, while a client controls the system — so local physics can't fight the interpolated pose writes. The controller's rigidbody is returned to simulation. This is applied only when the controlling role actually changes, not every frame. Disable it when other code owns the rigidbody's kinematic state.

## Projected Physics Bodies

`NetworkTransform` interpolates a received pose; it does not run local physics on non-controllers. For a rigidbody that should simulate locally on every peer and converge toward the server's state instead of just following it, use `ProjectedRigidbody`.

## See Also

The replicated component this behaviour owns and binds to is `UnityTransformComponentBase` (`UnityLocalTransformComponent` or `UnityWorldTransformComponent` depending on Transform Space) — see [TransformComponent](../../core-api/state/transform-component) for its API.
