---
title: "Network Interest Object"
---

> **Driving the core API directly?** See [Registering interest conditions](../../core-api/interest/registering-interest-conditions.md).

`NetworkInterestObject` sets interest rules for a whole prefab. Its rules apply to every `NetworkSystem` on the object, so the object is filtered as the one thing a player sees. It needs a `NetworkSystemObject` on the same GameObject. Only the server resolves interest, so on a client the component does nothing.

## Add rules to the prefab

Add rules with the list's add button. Each rule only restricts, so an empty list filters nothing; it does not hide the object from everyone.

- **Controller Only** (`AuthoredControllerOnlyInterestCondition`) shows the object only to the client that controls it, for an inventory or other private state. It has no settings. Add it to each prefab that needs it, not to the Unity Interest Manager's **World Rules**: there it applies to every object, and an object no client controls is shown to no client. This is the only rule a free build offers here.
- **Distance** (Pro) stops replication past a distance. See [Limit what a client receives by distance](./limit-replication-by-distance.md).

The Scene rule (`AuthoredSceneInterestCondition`) is world-only (`IsObjectScope` is `false`), so it is offered on the Unity Interest Manager instead.

To add your own rule, derive from `AuthoredInterestCondition`, mark the type `[Serializable]`, and build its `IInterestCondition` in `CreateCondition()`, which is called for every system on the object. It then appears in the list beside the shipped rules.

At most one rule on an object may decide by distance (`IsPositionCondition` is `true`). A second is refused as the object spawns, and the inspector warns while the list holds more than one.

## Choose whether a stopped object is removed

**Despawn When All Stopped** is on by default: the object is removed from a player once every system on it has stopped for that player. Turn it off for something a player should keep seeing after it stops updating, such as a landmark or a corpse. Nothing on the component will then remove the object; something else has to. See [Frozen or gone: what a stop does to the object](./stopping-objects-in-unity.md).

## Override a stop from a script

The component raises `NetworkSystem.InterestStopResolving` for its systems as its own `InterestStopResolving` event. A handler can waive a stop the rules resolved, or stop a player the rules did not. See [Override a stop with InterestStopResolving](./stopping-objects-in-unity.md#override-a-stop-with-intereststopresolving).
