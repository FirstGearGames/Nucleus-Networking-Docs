---
title: "Frozen or gone: what a stop does to the object"
---

> **Driving the core API directly?** See [Stopping versus culling](../../core-api/interest/stopping-versus-culling).

## The two outcomes

When a `NetworkSystem` stops for a connection, that stop resolves to one of two things. A stopped system keeps its object on the receiver: the object stays where it was, frozen, and is cheap to undo, because bringing it back is just resuming the delta stream rather than spawning anything. A reclaimed system is despawned instead, and released exactly as an ordinary despawn releases it.

Which one happens is set with `NetworkSystem.DespawnWhenStoppedEnabled`. It is independent of whatever stopped the system in the first place: conditions and `InterestStopResolving` decide *whether* a system stops, and this field decides what that stop then costs the receiver.

## Despawn When All Stopped

On `NetworkInterestObject` this is the **Despawn When All Stopped** checkbox. It is on by default, and it sets `DespawnWhenStoppedEnabled` to the same value on every `NetworkSystem` linked to the object, because the object leaves whole or not at all.

For an object carrying a single system, the checkbox is a straightforward decision. For an object carrying several systems, it is a vote and not a decision: the object is reclaimed only once *every* member is stopped and asking to be. One member that still wants to be heard — because its own conditions haven't stopped it, or because a script handling `InterestStopResolving` waived the stop — keeps the whole object where it is for that player.

## When to turn it off

Turn off **Despawn When All Stopped** for something a player should go on seeing after it stops updating: a landmark, a corpse, anything whose value is in still being there rather than in still updating. Left frozen, it stays standing until something else takes it away.

The inspector warns about this once the field is cleared: nothing in interest will ever take the object away again. Despawning it is then a job for other game logic entirely — a lifetime timer, an explicit despawn call, whatever fits the object.

## Handing a system back: InterestStopResolving

Authored rules can only restrict — a condition can stop a system but never un-stop one. `NetworkInterestObject.InterestStopResolving` is the seam for a decision an authored rule can't express: waiving a stop the rules resolved, or stopping a pair the rules didn't.

```csharp
public event NetworkSystem.InterestStopResolvingHandler InterestStopResolving
```

It fires once per (system, connection) pair on the interest cadence, carrying one `InterestStopContext` for the whole object rather than one subscription per member. A handler tests `InterestStopContext.NetworkSystem` against the system it cares about and leaves the context alone otherwise:

```csharp
private void OnInterestStopResolving(ref InterestStopContext context)
{
    if (context.NetworkSystem != _mySystem)
        return;

    context.IsStopped = false; // keep this member alive for the player
}
```

Declining a stop this way keeps the whole object with that player while **Despawn When All Stopped** is on — that's the lever for letting something cheap outlive the rest of the object it sits on.

## What a subscriber is held to

`InterestStopResolving` runs on the network loop thread, inside the serialization pass, once per (system, connection) pair. Handlers are held to the same contract as an interest condition: pure, cheap reads that neither start nor stop systems, mutate observers, nor block.

## Gotcha: subscribing costs a walk

A `NetworkSystem` is only visited by the interest pass if it has something to evaluate — either registered conditions or a subscriber to `InterestStopResolving`. Subscribing is on its own a reason for the pass to walk the object: an otherwise rule-free prefab that hooks `InterestStopResolving` starts paying for the evaluation pass even though it authored no conditions at all. Only subscribe where the decision is actually needed.
