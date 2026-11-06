---
title: "Refusing a scene load"
---

## Implement and register a validator

`ISceneLoadValidator` lets the server refuse to place a client in a scene instance before the client is asked:

```csharp
public interface ISceneLoadValidator
{
    bool CanLoadScene(Connection connection, uint sceneHandle, ushort sceneId);
}
```

- `connection`: the client the server is about to ask.
- `sceneHandle`: the live scene instance.
- `sceneId`: the scene asset that instance was opened from.

Return `true` to allow the request or `false` to refuse it. Only decide: do not open scenes, send messages or otherwise act inside it.

```csharp
sceneManager.RegisterSceneLoadValidator(myValidator);

// later
sceneManager.TryUnregisterSceneLoadValidator(myValidator);
```

## The first refusal wins

You can register any number. Before `TryRequestSceneLoad` asks a client into a scene, the server calls them in order and stops at the first that returns `false`. Validators after it are not called. With none registered, or none refusing, the request goes ahead.

## The client is never told

A refused request is never sent, so the client cannot tell a refused scene from one that was never offered. That makes a validator the place for entitlement rules such as a party requirement, a ticket, a subscription or a ban.

## Do not use a validator for capacity or visibility

- **Capacity**: how many scenes a peer can hold is `ISceneLoader.MaximumConcurrentScenes`. Do not count scenes in a validator.
- **Per-object visibility**: which objects in a scene a client sees is decided by interest. A validator only decides whether the client is placed in the scene at all.

## Keep validators cheap

Every validator runs on every gated placement, for every client, until one refuses. Keep it to an in-memory check, or cache the result of any database or service lookup.
