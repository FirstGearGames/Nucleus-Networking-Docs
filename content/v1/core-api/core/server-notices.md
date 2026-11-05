---
title: "Kick and refusal notices"
---

The engine attaches no reason to a kick or a refusal. To tell the client why, the server passes a notice, an ordinary message type of your own, to the kick or refusal, and the engine sends it on the reliable channel ahead of the disconnect.

## Define one notice type per reason

The client tells a kick or refusal from any other disconnect by the notice's type. Give each reason you want to tell apart its own type, or carry the detail in a field:

```csharp
[NetworkType]
public struct ServerFullNotice : IMessage
{
    public string Text;
}

[NetworkType]
public struct KickedNotice : IMessage
{
    public string Text;
}
```

Leave `IsAuthenticationRequired` at its default. A message from the server reaches a client that is not yet authenticated whatever that property says, so a refusal's notice still arrives.

## Pass the notice to DenyClient or Kick

```csharp
// Refusing a connecting client from an authenticator.
coreManager.ServerManager.DenyClient(connection, new ServerFullNotice { Text = "Server is full." });

// Kicking a client already in the session.
connection.Kick(new KickedNotice { Text = "Idle for too long." });
```

Both send the notice before marking the kick, which is the only order that works, because a kick blocks every message queued after it. The plain `DenyClient(connection)` and `Kick()` send nothing. See [Kicking and disconnecting a client](./kicking-and-disconnecting.md) for the policy and timeout, and [Authenticating clients](./authentication.md) for when to refuse.

## Register the handlers on the client before connecting

Register a handler for each notice with `MessageManager.RegisterMessageHandler<T0>` before connecting, so a refusal during the handshake is not missed:

```csharp
public sealed class DisconnectReasons
{
    public string LastReason { get; private set; }

    public DisconnectReasons(MessageManager messageManager)
    {
        messageManager.RegisterMessageHandler<ServerFullNotice>(OnServerFull);
        messageManager.RegisterMessageHandler<KickedNotice>(OnKicked);
    }

    private void OnServerFull(in MessageContext messageContext, ServerFullNotice notice) => LastReason = notice.Text;

    private void OnKicked(in MessageContext messageContext, KickedNotice notice) => LastReason = notice.Text;
}
```

The notice reaches its handler before the client's own disconnect is raised, so a disconnect handler can read what the notice handler recorded, such as `LastReason` above. When no notice handler ran, the disconnect had another cause: the server sent no reason, the link timed out, or the server shut down.
