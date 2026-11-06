---
title: "Frozen or gone: what a stop does to the object"
---

> **Driving the core API directly?** See [Stopping versus culling](../../core-api/interest/stopping-versus-culling.md).

When a `NetworkSystem` stops for a player, its object either stays on that player's client, frozen where it was, or is despawned there like an ordinary despawn. A frozen object is cheap to bring back, because only its updates resume.

`NetworkSystem.DespawnWhenStoppedEnabled` chooses which. Rules and `InterestStopResolving` decide whether a system stops; this setting decides what the stop does.

## Choose frozen or gone with Despawn When All Stopped

On `NetworkInterestObject`, the **Despawn When All Stopped** checkbox sets `DespawnWhenStoppedEnabled` on every `NetworkSystem` on the object. It is on by default.

On an object with several systems, the object is despawned for a player only once every system has stopped for that player. One system still replicating, because its rules have not stopped it or a handler waived the stop, keeps the whole object with that player.

Turn it off for something a player should keep seeing after it stops updating, such as a landmark or a corpse. Interest will then never remove the object, and the inspector warns about this. Remove it some other way, such as a lifetime timer or an explicit despawn.

## Override a stop with InterestStopResolving

Rules can stop a system but never un-stop one. `NetworkInterestObject.InterestStopResolving` lets you waive a stop the rules resolved, or stop a pair the rules did not:

```csharp
public event NetworkSystem.InterestStopResolvingHandler InterestStopResolving
```

It fires once per (system, connection) pair on the interest cadence, and one subscription covers every system on the object. Test `InterestStopContext.NetworkSystem` against the system you care about and leave other contexts alone:

```csharp
private void OnInterestStopResolving(ref InterestStopContext context)
{
    if (context.NetworkSystem != _mySystem)
        return;

    context.IsStopped = false; // keep this member alive for the player
}
```

While **Despawn When All Stopped** is on, waiving a stop on one system keeps the whole object with that player.

Follow these rules in a handler:

- Keep it a cheap, pure read. It runs on the network loop thread, and must not start or stop systems, change observers, or block.
- Subscribe only where you need the decision. A subscriber alone makes the interest pass visit the object, even if the prefab has no rules.
