---
title: "What Nucleus is"
---

Nucleus is a networking engine for server-authoritative multiplayer games. Its core is plain C# that runs on any .NET host. The Unity integration is a layer on top of that core, so the same networking code runs in a Unity game and in a dedicated server with no Unity installed.

## Pick the pages for how you use Nucleus

- If you work in the Unity editor, follow the Unity pages in Start Here, then read the Unity section.
- If you call Nucleus from plain C#, such as a console app or a dedicated server, follow the .NET pages in Start Here, then read the Core API section.

## Three ideas run through everything

**Every networked object is a network system.** A `NetworkSystem` holds one or more `NetworkComponent`s, and each component declares its replicated values as `NetworkMember<T0>` fields:

```csharp
public partial class ScoreComponent : NetworkComponent
{
    public readonly NetworkMember<int> Score = new();
}
```

**The server decides what is true.** The server sends each object's state to the clients. A client can only change an object the server lets it control, such as its own player.

**Each client receives only the objects it can see.** Interest rules decide which objects the server sends to each client. With no rules, every client receives every object.

Coming from FishNet? The [FishNet to Nucleus name map](../reference/fishnet-name-map.md) lists the Nucleus name for each FishNet type.
