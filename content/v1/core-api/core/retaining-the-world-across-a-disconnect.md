---
title: "Keeping the world across a disconnect"
---

## Choosing what a dropped client does with its world

When a client's link to the authority drops, `ClientManager.DisconnectResetMode` decides what happens to the world that client was holding:

```csharp
coreManager.ClientManager.DisconnectResetMode = DisconnectResetMode.RetainReceivedWorld;
```

`DisconnectResetMode` has two values:

- **`ClearReceivedWorld`** (the default): despawns every `NetworkSystem` the authority sent and releases every networked scene it placed the client in. The next session starts from nothing.
- **`RetainReceivedWorld`**: leaves every received `NetworkSystem` started and every networked scene loaded, exactly as they stood when the link dropped.

`RetainReceivedWorld` only makes sense for a peer that means to keep the world rather than discard it — one that disconnects from a host and intends to start its own server to carry on hosting what it was just shown. A retained world is still stamped with the departed authority's identifiers, so it's only usable once this peer adopts it as its own (see below). Any other client that reconnects elsewhere drops everything it's holding and rebuilds from whatever the new authority sends, regardless of this setting — retention only ever survives until the next link comes up.

The field itself is present and settable in every edition. In a Free build it simply does nothing: the branches that honor `RetainReceivedWorld` live in the Pro partials (`ClientManager.Adoption.Pro.cs`, `ServerManager.Adoption.Pro.cs`, `SceneManager.Adoption.Pro.cs`), and a Free client always clears its world on disconnect regardless of how the field is set.

## Adopting a retained world

A peer that retained a world takes it over with `ServerManager.AdoptRetainedWorld()` instead of respawning everything from scratch:

```csharp
coreManager.ServerManager.AuthorityAdopted += OnAuthorityAdopted;

if (coreManager.ServerManager.AdoptRetainedWorld())
    await transport.ConnectAsync(Invoker.Server);

void OnAuthorityAdopted(uint adoptedSystemCount, uint adoptedSceneCount)
{
    // Re-attach whatever this peer only did as a spectator while it was a client.
}
```

`AdoptRetainedWorld()` returns `true` when a world was adopted, and `false` when this peer holds nothing it was sent. It fires `AuthorityAdopted(uint adoptedSystemCount, uint adoptedSceneCount)` on success, so a game can re-attach whatever it only does for objects it owns once this peer becomes their authority.

**Call it after the link has dropped and before starting the server.** `AdoptRetainedWorld()` refuses to run once `TransportManager.IsServerStarted` is true, because being the authority changes the meaning of the interest pass, the recovery pass, and the scene and bundle request handlers from the instant the server socket connects.

Adoption keeps every identifier the world already has and raises the allocators past them, rather than renumbering. Renumbering would surface as the entire world despawning and respawning, since an identifier is the only name an object has.

`AdoptRetainedWorld()` doesn't start anything itself. The caller starts the server, and — if this peer's own player is meant to keep playing — connects its own client half afterward. A pure-server successor holds the world but has no character in it.

## Skipping the reconcile on reconnect

A retained world normally reconciles against the new authority as an ordinary deserialize: identifiers this peer already holds apply in place, and the objects never blink. Setting `SystemManager.RespawnWorldOnReconnectEnabled` skips that reconcile entirely — the world is dropped and rebuilt from the authority's own account of it instead, at the cost of a spawn per object, but without carrying over anything from a reign the authority never heard of. When this is set, `RetainReceivedWorld` no longer changes how reconnecting behaves.

## Telling survivors where to regroup

Retaining and adopting a world only helps if the other peers can still find the promoted host — and the moment the old host drops, there's no channel left to tell them. `SessionDirectoryMessage` is how a game tells clients that beforehand:

```csharp
public struct SessionDirectoryMessage : IMessage
{
    public ulong SessionId;

    public const ulong NoSession = 0;
}
```

Send it over `Channel.Reliable` once a client authenticates, and to any client that joins later:

```csharp
coreManager.ServerManager.ClientAuthenticated += connection =>
{
    connection.SendMessage(Channel.Reliable, new SessionDirectoryMessage(sessionId));
};
```

`SessionId` names the session with whatever directory the game rendezvouses through, or `SessionDirectoryMessage.NoSession` when the host isn't registered with one. Nucleus carries the identifier alone and defines no address, service, or protocol — what it means, and which directory answers to it, is entirely up to the game.

Treat `SessionId` as a secret shared with the players and nobody else. A directory has no way of telling a peer that was told this identifier from one that wasn't, so whoever holds it can generally take the session over. That's the point of it, and also the whole of its security.

## Where this stops

This page covers keeping and adopting the world's *state*. Actually getting the survivors reconnected to the promoted host — relay host migration and the services it needs — is covered under transports and hosting, not repeated here.
