---
title: "Play mode, domain reload and session lifetime"
---

> **Driving the core API directly?** See [Shutting a session down](../../core-api/core/shutting-down-a-session.md).

## Nucleus works with domain reload disabled

Nucleus resets its own static state, such as its `CoreManager` and its registered prefabs, at the start of every play session. It behaves the same with domain reload on or off (**Enter Play Mode Options**), and there is nothing to configure.

If your game keeps static fields of its own and you disable domain reload, reset them yourself, for example in a method marked `[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]`.

## End a session

A session ends when its `UnityCoreManager` is destroyed, including when play mode stops. To end one from code, call `CoreManager.Deinitialize()`. Calling it more than once is safe, and `CoreManager.IsDeinitialized` tells you whether it has run.

A deinitialized `CoreManager` cannot be started again. A new session always builds a new one.

## Fix a session that leaked into the next one

**A handler fires twice, or answers for an object that no longer exists.** Something from the previous session is still subscribed. Check that its `UnityCoreManager` was really destroyed: a `DisallowMultipleComponent` conflict, a disabled GameObject or an abrupt stop can skip the teardown. With domain reload disabled, a static field in your own code that still holds a handler is another common cause.

**`CoreManager.Instance` is not the manager you expect, or a manager keeps responding after play has stopped.** The previous `CoreManager` was never torn down. Nucleus forgets it when the next session starts but cannot shut it down for you. Look in the previous session's log for an error thrown while its `UnityCoreManager` was starting or being destroyed.

**Content that loaded in the first session does not load in the second.** Registered prefabs are cleared at the start of every session. Check that your `NetworkPrefabCollection` is loaded in the new session.
