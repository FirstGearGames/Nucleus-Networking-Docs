---
title: "Network Interest Object"
---

> **Driving the core API directly?** See [Registering interest conditions](../../core-api/interest/registering-interest-conditions).

## Description

`NetworkInterestObject` authors interest rules once for a prefab, and those rules apply to every `NetworkSystem` on the object. An object built from several systems is filtered as the one thing a player sees, not as separate components each judged on their own.

It requires a `NetworkSystemObject` on the same object, and it does nothing on a client: only the server resolves interest, so the component registers no conditions and hooks nothing there.

## Rules

The `Rules` list holds `[SerializeReference]` entries of type `AuthoredInterestCondition`, drawn by an add-button list rather than the default inspector, because a `[SerializeReference]` list is not something the default inspector can author. Each entry builds its own `IInterestCondition` for every system on the object via `AuthoredInterestCondition.CreateCondition()`.

In a free build, the list ships with no entry at all. The Scene rule (`AuthoredSceneInterestCondition`) is world-scope only — `IsObjectScope` is `false` and `CreateCondition()` returns `null` — so it is offered on the Unity Interest Manager instead of on a prefab. A game can add its own rule by deriving from `AuthoredInterestCondition` and marking the derived type `[Serializable]`; it sits in the list beside whatever ships.

An empty `Rules` list filters nothing. It does not mean "hide from everyone" — rules only ever restrict what would otherwise replicate.

## Despawn When All Stopped

`_despawnWhenAllSystemsStoppedEnabled`, labeled **Despawn When All Stopped** in the inspector, defaults to `true`. When on, the object is reclaimed from a player once every system on it has stopped for that player, rather than being left standing there frozen.

Turn it off for something a player should keep seeing after it stops updating — a landmark or a corpse. The editor's own warning is explicit about the tradeoff: with the toggle off, nothing on the component will ever take the object away again; something else has to.

## InterestStopResolving

The component re-surfaces `NetworkSystem.InterestStopResolving` as its own `InterestStopResolving` event. A handler tests the event's `InterestStopContext.NetworkSystem` against the system it owns and leaves the context alone otherwise; it can waive a stop the object's rules resolved, or stop a player the rules did not.

Subscribing to this event is itself the reason the evaluation pass walks the object: gaining the first listener hooks `InterestStopResolving` on every currently linked system, and losing the last listener unhooks it again, so an object that authors rules and subscribes to none of this pays for none of it.

## Pooling

Rules are re-registered from `Awake`, not from a subscription that could be missed. A system linked before this component woke — the case for a context-aware rent that resolves inside the prefab's own `Awake` — raises nothing for this component to subscribe to. So `Awake` walks every system already linked (`_networkSystemObject.Systems`) and adopts each one, which is how a pooled object's next life re-registers everything its previous life's pool return dropped.

## One distance rule per system

At most one authored entry on an object may report `IsPositionCondition => true`. A second is refused where it registers, because it would resolve the same pairs again to reach an answer it cannot change. The inspector counts position-condition entries and warns at authoring time when more than one is present, rather than leaving the mistake to a log line on the first spawn.
