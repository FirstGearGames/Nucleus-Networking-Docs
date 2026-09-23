---
title: "Limit what a client receives by distance"
---

> **Driving the core API directly?** See [Distance interest conditions](../../core-api/interest/distance-interest-conditions.md)

A Distance rule stops an object's systems replicating to a player once that player is too far away. It is an inspector-only rule with two places to add it, one setting to tune, and one warning to know about.

## Where a rule lives

A Distance rule can be added in two places, and they mean different things:

- **World Rules**, on `UnityInterestManager` — applies to every object in the world.
- **Rules**, on `NetworkInterestObject` — applies to this prefab only, and stacks on top of whatever the world rules already say.

Both lists take the same authored rule types. Add the rule to the manager when the cutoff should be a world-wide policy; add it to the prefab when only that object should stop being sent at distance.

## Adding the rule

Add a Distance rule to either list, then set its **Stop Distance**: the distance past which the object stops replicating to a player.

Leaving Stop Distance at `0` disables the rule entirely — it builds nothing, so an untouched entry costs nothing.

## What the distance is measured from

The distance is measured from the `NetworkSystem`s the client controls, not from a camera and not from a "player" the engine has no concept of. A client controlling nothing measurable is never restricted by the rule.

## Interest Axes

`UnityInterestManager` has an **Interest Axes** setting that governs how every distance in the world is measured: the full volume (`Xyz`), or one of the three planes that drops a single axis. A top-down world sets this to **Xz** so height nobody travels is ignored, and a player standing on a floor above something is not treated as far away from it.

## Interest Technique

**Interest Technique** on `UnityInterestManager` chooses how those distances are reached: **Pairwise** compares each object against each client's own objects directly, and is cheapest until there are many of both; the shared spatial grid narrows to nearby objects first. Both give the same answers.

Leave it on Pairwise until the cutoff excludes most pairs. Settle the choice before anything carrying a distance rule spawns — it is refused afterward.

## One distance rule per system

A `NetworkSystem` accepts only one rule that decides by distance. A second one is refused, and logged, as the object spawns. The `NetworkInterestObject` inspector counts the rules in its **Rules** list and warns when more than one decides by distance, so the mistake is visible before it ships rather than only in a log line at runtime.

## Pro

Distance is a Pro feature. A free build ships the interest system and the world-wide Scene rule, but no distance rule anywhere — on a free build, a `NetworkInterestObject`'s **Rules** list has no shipped entry to add at all.
