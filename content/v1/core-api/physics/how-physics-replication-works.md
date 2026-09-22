---
title: "How physics replication works"
---

## The loop

Every physics body Nucleus replicates follows the same loop, regardless of which engine drives it.

The controlling peer simulates the body normally and, once per tick, captures the stepped result: world position, world rotation, and a set of condition flags. That capture rides the wire as ordinary replicated members, alongside the tick it was captured at.

Every other peer holds a proxy for that body. Each physics step, the proxy rebuilds the latest server snapshot from those members, projects it forward by however many ticks old it is, and converges its own simulated body onto the projected result. The proxy is never teleported onto the raw received pose; it is steered toward a moving target that accounts for the snapshot's age.

## Velocity is derived, not sent

Linear and angular velocity never cross the wire. Each side derives them independently from the change in position and rotation across the last two committed ticks, divided by the time between those ticks.

This halves what a moving body costs: a body in motion would otherwise carry position, rotation, *and* both velocities every tick it changes. A resting body carries nothing new at all, since an unchanged capture doesn't restamp its tick.

## A proxy keeps simulating

A proxy body is never written directly onto the received pose. It keeps stepping through the same physics engine as the controller, with its velocity steered toward the projected target and its pose blended or corrected against divergence. Contacts, stacks, and collisions involving a proxy stay real on every peer, because every peer is still actually simulating it — not just moving a transform to match a number that arrived.

## What's on the wire, and what isn't

Three things replicate: world position, world rotation, and a small set of condition flags (whether the body is sleeping, whether it's kinematic, and whether it has been captured at all). A capture tick rides alongside them so a receiver can anchor its projection to the snapshot's exact age.

No engine type ever crosses that boundary. The replicated members and the snapshot they rebuild are expressed in `System.Numerics` — `Vector3` and `Quaternion` — never an engine-specific vector, quaternion, or rigidbody handle. The core has no dependency on any particular physics engine; an integration is responsible for reading its engine's body into that shape and writing the projected result back onto it.

Position and rotation ride Divine or Interval transmission like any other member — the choice is per-member, not physics-specific. Divine can go quiet for stretches where Interval would still send every tick; what differs between editions is only how tightly the correction packs, not whether Divine or Interval is available.

## What isn't built

This model does not include:

- Server-side rewind
- Lag-compensated queries
- Projectile catch-up compensation
- Replay-correct collision callbacks

These are planned, not hidden. A resimulated, full-world rollback approach to physics was tried and archived; the model here — capture, project, converge — is what shipped in its place.

## Where core ends and integration begins

Everything above lives in the core engine, engine-agnostic and expressed in `System.Numerics`. Turning it into motion on an actual rigidbody — reading a body's state each tick, applying a projected target, wiring up sleep and kinematic flags — is an integration's job. Nucleus ships a Unity integration that does this for Unity's physics.

The core-side member and convergence types are the entry point for a custom or unsupported engine. The Unity-side components are the entry point for Unity.
