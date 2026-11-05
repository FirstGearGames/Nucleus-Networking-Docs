---
title: "Replicate a value"
---

> **Using Unity?** See [Add a player](./replicating-your-first-object.md).

This page adds a score that the server changes and the client receives. It builds on the server and client from [Run two peers in one process](./running-two-peers-in-one-process.md).

## Declare the value

Put the values you want to replicate in a `NetworkComponent`, one `NetworkMember<T0>` field each:

```csharp
using Nucleus.Components;

public partial class ScoreComponent : NetworkComponent
{
    public readonly NetworkMember<int> Score = new();
}
```

The class must be `partial`, because Nucleus generates the rest of it.

## Create the object on the server

Once `server.TransportManager.IsServerStarted` is true, rent a network system that carries the component, and set the value:

```csharp
using Nucleus.Systems;

if (NetworkSystemPool.TryRent<NetworkSystem, ScoreComponent>(server, out NetworkSystem? scoreSystem) && scoreSystem.TryGetComponent(out ScoreComponent score))
    score.Score.Value = 1;
```

Every value you write to `score.Score.Value` after this is sent to the client. When you no longer need the object, call `NetworkSystemPool.Return(scoreSystem)`.

## Find the object on the client

Before the client connects, ask to be told when a system carrying `ScoreComponent` arrives:

```csharp
NetworkSystemWatch? watch = NetworkSystemPool.Watch<NetworkSystem, ScoreComponent>(client, scoreSystem =>
{
    if (scoreSystem.TryGetComponent(out ScoreComponent score))
        Console.WriteLine($"The client found the score: {score.Score.Value}");
});
```

Call `NetworkSystemPool.Unwatch(watch)` when you no longer need it.

## React when the value changes

Override `OnMembersChanged` in the component. `MemberChangeDirection.Read` means the change arrived from the network:

```csharp
public partial class ScoreComponent : NetworkComponent
{
    public readonly NetworkMember<int> Score = new();

    public override void OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection)
    {
        if (memberChangeDirection == MemberChangeDirection.Read)
            Console.WriteLine($"Score is now {Score.Value}");
    }
}
```

Run the program and increase the score on the server every second. The client prints each new score.
