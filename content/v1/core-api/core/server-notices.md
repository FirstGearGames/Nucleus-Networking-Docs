---
title: "Kick and refusal notices"
---

## The reason is a message you define

When the server kicks or refuses a client, the engine attaches no reason of its own. If the client should know why, the server sends a notice: an ordinary message type of your own, passed to the kick or the refusal, which the engine sends on the reliable channel ahead of the disconnect.

The client tells a kick or a refusal apart from any other disconnect by the notice's message type. Give each kind of reason you want to tell apart a type of its own, or carry the detail in a field:

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

A notice type needs no authentication exemption. A message from the server reaches a client that is not yet authenticated whatever its `IsAuthenticationRequired` says, so a refusal's notice arrives even though the client never got as far as being approved. Leave `IsAuthenticationRequired` at its default.

## Sending one from the server

Pass the notice to the call that ends the client's session:

```csharp
// Refusing a connecting client from an authenticator.
coreManager.ServerManager.DenyClient(connection, new ServerFullNotice { Text = "Server is full." });

// Kicking a client already in the session.
connection.Kick(new KickedNotice { Text = "Idle for too long." });
```

Both send the notice first and then mark the kick, which is the only order that works: a kick blocks every message queued after it. [Kicking and disconnecting a client](./kicking-and-disconnecting.md) covers the kick policy and the timeout, and [Authenticating clients](./authentication.md) covers when to refuse. The plain `DenyClient(connection)` and `Kick()` send nothing, which is the right default for a failed authentication: a refused peer is owed no explanation, and one can help an attacker.

## Receiving one on the client

The client receives a notice like any other message, through a handler registered with `MessageManager.RegisterMessageHandler<T0>`. Register the handlers before connecting, so a refusal that arrives during the handshake is not missed:

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

## The notice arrives before the disconnect

A close the server makes is held on the client until the messages that arrived with it have been dispatched, so a kick's or a refusal's notice reaches its handler before the client's own disconnect is raised. A disconnect handler can therefore read whatever the notice handler recorded, such as `LastReason` above, and show it. When no notice handler ran, the disconnect had some other cause: the server sent no reason, the link timed out, or the server shut down.
