---
title: "Play mode, domain reload and session lifetime"
---

> **Driving the core API directly?** See [Shutting a session down](../../core-api/core/shutting-down-a-session.md).

## Nucleus resets its own state every play session

Nucleus resets its static state at the start of every play session, before any of your code runs. That is what lets it work with Unity's domain reload disabled (**Enter Play Mode Options** in the project settings): nothing from the previous session, such as its `CoreManager` or its registered prefabs, carries into the next one. There is nothing to configure, and it behaves the same with domain reload on or off.

The reset covers Nucleus's own state only. If your game keeps static fields of its own and you disable domain reload, resetting them is up to you, for example in a method marked `[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]`.

## Stopping play tears the session down

A session ends when its `UnityCoreManager` is destroyed, which happens when play mode stops or when you destroy its GameObject yourself. Destroying it shuts down the session's `CoreManager`: the managers are released, the network loop stops and the transports shut down.

To end a session from code, call `CoreManager.Deinitialize()`. Calling it more than once is safe, and `CoreManager.IsDeinitialized` tells you whether a manager has already been torn down.

## A torn-down `CoreManager` is not reusable

Once `Deinitialize()` has run, `IsDeinitialized` stays `true` for the life of that object, and there is no way to initialize it again. A new session always builds a new `CoreManager`.

## Symptoms of a session that leaked into the next one

**A handler fires twice, or answers for an object that no longer exists.** Something is still subscribed from the previous session. Check whether that session's `UnityCoreManager` was actually destroyed: a `DisallowMultipleComponent` conflict, a disabled GameObject, or a session stopped abruptly can skip the teardown and leave its subscriptions live. With domain reload disabled, a static field in your own code that still holds a handler is another common cause.

**`CoreManager.Instance` is not the manager you expect, or a manager keeps responding after play has stopped.** The previous session's `CoreManager` was never torn down. Nucleus forgets it when the next session starts, but it cannot shut it down for you, so whatever it still holds stays alive. Look in the previous session's log for an error thrown while its `UnityCoreManager` was starting or being destroyed.

**Content that loaded in the first session does not load in the second.** Nucleus clears its registered prefabs at the start of every session, so each session loads its content again. Check that your `NetworkPrefabCollection` is actually loaded in the new session.
