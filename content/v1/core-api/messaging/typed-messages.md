---
title: "Typed Messages"
---

> **Using Unity?** See [Typed Messages in Unity](../../unity/messaging/messages-in-unity.md).

A message is a payload sent to one peer. It is never routed onward and never echoed back to the sender.

## Declare a message type

A message type implements `IMessage`:

```csharp
public interface IMessage
{
    public bool IsAuthenticationRequired => true;
}
```

By default the sender must be authenticated. A message from an unauthenticated sender is refused, and the sender is kicked through `ServerManager.KickClient`.

Override `IsAuthenticationRequired` to `false` only for your authenticator's pre-authentication messages, such as the client's token, or the server refuses them. The engine ships no such types. Messages from the server reach a client that is not yet authenticated whatever the type says, so a refusal sent with `DenyClient` needs no override. The value is read once per type, when its handler is first registered.

## Register a handler

```csharp
public void MessageManager.RegisterMessageHandler<T0>(MessageReceivedHandler<T0> messageReceivedHandler) where T0 : IMessage, new();
public void MessageManager.UnregisterMessageHandler<T0>(MessageReceivedHandler<T0> messageReceivedHandler) where T0 : IMessage, new();

public delegate void MessageReceivedHandler<T0>(in MessageContext messageContext, T0 message) where T0 : IMessage, new();
```

The handler returns nothing, because a message is never relayed.

```csharp
private void OnChatMessage(in MessageContext messageContext, ChatMessage message)
{
    // handle it
}

coreManager.MessageManager.RegisterMessageHandler<ChatMessage>(OnChatMessage);
```

Unregister the same delegate instance when you stop listening.

## Send a message

```csharp
public void Connection.SendMessage<T0>(Channel channel, T0 data) where T0 : IMessage, new();
```

This sends `data` to that one `Connection`. A host sending to its own other half is delivered in process. If the send logs a hash error and sends nothing, see [Messages and Calls That Do Not Arrive](./messaging-troubleshooting.md).

## Read MessageContext

```csharp
public readonly struct MessageContext
{
    public readonly Channel Channel;
    public readonly Connection SenderConnection;
    public bool IsSenderServer => SenderConnection.IsServer;
}
```

- `Channel`: the channel the message travelled on.
- `SenderConnection`: the peer that sent it. Never null, unlike a call's `RpcContext.SenderConnection`.
- `IsSenderServer`: whether the server sent it. On a host, this is the only way to tell which half a message came from, because `TransportManager.IsServerStarted` says nothing about a particular message.
