---
title: "Keeping the world across a disconnect"
---

## Choose what a dropped client does with its world

`ClientManager.DisconnectResetMode` decides what happens to a client's world when its link to the server drops:

```csharp
coreManager.ClientManager.DisconnectResetMode = DisconnectResetMode.RetainReceivedWorld;
```

- **`ClearReceivedWorld`** (the default) despawns every `NetworkSystem` the server sent and releases every networked scene it placed the client in.
- **`RetainReceivedWorld`** leaves every received `NetworkSystem` started and every networked scene loaded, as they stood when the link dropped.

Use `RetainReceivedWorld` only on a peer that will start its own server to carry on hosting the world it was shown. A retained world still carries the departed server's identifiers, so it is only usable once this peer adopts it. A client that reconnects elsewhere drops everything and rebuilds from the new server, whatever this setting says.

Honoring `RetainReceivedWorld` is Pro-only. The field exists in every edition, but a Free client always clears its world on disconnect.

## Adopt a retained world before starting the server

1. Wait until the link has dropped.
2. Call `ServerManager.TryAdoptRetainedWorld()`. It returns `true` when a world was adopted and `false` when this peer holds nothing it was sent. It refuses to run once `TransportManager.IsServerStarted` is true.
3. Start the server.
4. If this peer's own player should keep playing, connect its client half afterwards. A pure-server successor holds the world but has no character in it.

```csharp
coreManager.ServerManager.AuthorityAdopted += OnAuthorityAdopted;

if (coreManager.ServerManager.TryAdoptRetainedWorld())
    await transport.ConnectAsync(Invoker.Server);

void OnAuthorityAdopted(uint adoptedSystemCount, uint adoptedSceneCount)
{
    // Re-attach whatever this peer only did as a spectator while it was a client.
}
```

On success it raises `AuthorityAdopted(uint adoptedSystemCount, uint adoptedSceneCount)`, so the game can re-attach whatever it only does for objects it owns. Adoption keeps every identifier the world already has, so no object despawns and respawns.

## An adopted world can be missing the old host's last changes

This peer adopts the world as it last saw it. In `AuthorityAdopted`, correct anything players can trade or sell from a record kept outside the session. [A handover can undo the old host's most recent changes](../transports/newfarm-host-migration.md#a-handover-can-undo-the-old-hosts-most-recent-changes) lists what is lost and how to keep currency and inventories safe.

## Rebuild instead of reconciling on reconnect

A retained world normally reconciles against the new server: identifiers this peer already holds apply in place, and objects never blink. Set `SystemManager.RespawnWorldOnReconnectEnabled` to drop the world and rebuild it from the server's account instead, at the cost of a spawn per object, without carrying anything over that the server never heard of. With it set, `RetainReceivedWorld` no longer changes how reconnecting behaves.

## NewfarmHostMigration tells survivors where to regroup

Once the old host drops, nothing is left to tell the other peers where the promoted host is. [`NewfarmHostMigration`](../transports/newfarm-host-migration.md) tells every client which session it is in while the host is still there, so the survivors can find the promoted host. A game never sends or reads `SessionDirectoryMessage`.
