---
title: "Refusing a scene load"
---

## What a validator does

`ISceneLoadValidator` gives the authority a chance to refuse a client before it is ever asked to load a scene instance:

```csharp
public interface ISceneLoadValidator
{
    bool CanLoadScene(Connection connection, uint sceneHandle, ushort sceneId);
}
```

- `connection` is the client the authority is about to ask.
- `sceneHandle` identifies the live scene instance.
- `sceneId` identifies the scene asset that instance was opened from.

Return `true` to let the request go out, `false` to refuse it. A validator is a predicate and nothing else: it must not open scenes, send messages, or otherwise act on what it's deciding.

Register one with `SceneManager.RegisterSceneLoadValidator`, and remove it with `UnregisterSceneLoadValidator` when it no longer applies:

```csharp
sceneManager.RegisterSceneLoadValidator(myValidator);

// later
sceneManager.UnregisterSceneLoadValidator(myValidator);
```

## Several validators, first refusal wins

Any number of validators may be registered. When `RequestSceneLoad` is about to ask a client into a scene, the authority walks the registered list in order and stops at the first one that returns `false`. If none are registered, or none refuse, the request proceeds. There's no voting and no override: one refusal is final, and validators after it aren't even asked.

This means validator order can matter if two validators disagree about edge cases, but it never matters for the common case of independent entitlement checks — each one only needs to say yes or no about its own rule.

## The client never finds out

A refusal happens before the request is sent. Nothing crosses the wire: no rejection message, no scene reference, no acknowledgment that a scene existed at all. From the client's point of view a refused scene is indistinguishable from one that was never offered.

This is deliberate, not an oversight to work around. It's what makes `ISceneLoadValidator` the right place for entitlement rules — a party requirement, a ticket, a subscription, a ban — where the answer has to come from the authority and can't be inferred or forged by a client that was told "no" and why.

## Where a validator is the wrong tool

**Capacity.** How many live scene instances a peer can hold at once is `ISceneLoader.MaximumConcurrentScenes`, a property of the loading strategy itself, not a per-client decision. Don't write a validator that counts scenes and refuses past some number — that logic already belongs on the loader.

**Per-object visibility.** Deciding which objects inside a scene a given client can see is interest's job, not the scene load's. A validator only answers whether the client is placed into the scene instance at all; it has no say over what becomes visible once they're in.

## Cost

`IsSceneLoadAllowed` runs the registered list once per gated placement — one call per validator until a refusal or the list ends. With no validators registered it's a single empty-list check, effectively free. A validator that does real work (a database lookup, a network call to an entitlement service) pays that cost on every scene placement it's asked about, for every client, so keep it to an in-memory check wherever possible, or cache the result behind whatever state already tracks the entitlement.
