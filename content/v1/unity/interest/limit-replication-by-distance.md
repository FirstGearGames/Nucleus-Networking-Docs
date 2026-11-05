---
title: "Limit what a client receives by distance"
---

> **Driving the core API directly?** See [Distance interest conditions](../../core-api/interest/distance-interest-conditions.md)

A Distance rule stops an object's systems replicating to a player once that player is too far away. Distance rules are Pro; a free build has none.

## Add a distance rule

1. Add a **Distance** rule to one of these lists:
   - **World Rules** on `UnityInterestManager`, to apply it to every object.
   - **Rules** on a prefab's `NetworkInterestObject`, to apply it to that prefab only, on top of the world rules.
2. Set **Stop Distance**: the distance past which the object stops replicating to a player. At `0` the rule is off and costs nothing.

Distance is measured from the `NetworkSystem`s the client controls, not from a camera. A client that controls nothing measurable is never restricted by the rule.

## Choose how distance is measured

Both settings are on `UnityInterestManager`. Set them before anything carrying a distance rule spawns; a change after that is refused.

- **Interest Axes**: `Xyz` measures the full volume, and each other option drops one axis. A top-down world uses **Xz**, so a player on a floor above an object is not treated as far from it.
- **Interest Technique**: **Pairwise** compares each object with each client's own objects, and is cheapest until there are many of both. **Spatial Grid** narrows to nearby objects first. Both give the same answers. Leave it on Pairwise until the cutoff excludes most pairs.

## Use one distance rule per object

A `NetworkSystem` accepts only one rule that decides by distance. A second is refused, and logged, as the object spawns. The `NetworkInterestObject` inspector warns when its **Rules** list holds more than one.
