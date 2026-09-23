---
title: "Typed Messages"
---

> **Using Unity?** See [Typed Messages in Unity](../../unity/messaging/messages-in-unity.md).

A message is a point-to-point payload sent to one peer. It is never routed onward and never echoed back to whoever sent it. Declare a type, register a handler for it, and send it with `Connection.SendMessage`.

## Declaring a message type

A message type implements `IMessage`:

```csharp
public interface IMessage
{
    public bool IsAuthenticationRequired => true;
}
```

`IsAuthenticationRequired` is the only member. It defaults to `true`, so an ordinary type needs no override: the sender must be authenticated or the message is refused. This is read once per type, from a throwaway instance, when the type's handler is first registered.

Only the handful of types that take part in the authentication handshake itself override it to `false`, because they must arrive before anyone is authenticated. `AuthenticationDenied` is one of these and answers `false`. The ordinary `AuthenticationResponse` answers `true` like everything else, because by the time it is sent authentication has already happened. Write your own custom authenticator's pre-auth message types the same way `AuthenticationDenied` does: answer `false`, or an unauthenticated peer can never receive them.

## Registering a handler

```csharp
public void MessageManager.RegisterMessageHandler<T0>(MessageReceivedHandler<T0> messageReceivedHandler) where T0 : IMessage, new();
public void MessageManager.UnregisterMessageHandler<T0>(MessageReceivedHandler<T0> messageReceivedHandler) where T0 : IMessage, new();
```

The handler shape:

```csharp
public delegate void MessageReceivedHandler<T0>(in MessageContext messageContext, T0 message) where T0 : IMessage, new();
```

It returns nothing. A call's handler answers whether the server may pass the call on; a message is never passed on, so there is no verdict for a handler to give.

```csharp
private void OnChatMessage(in MessageContext messageContext, ChatMessage message)
{
    // handle it
}

coreManager.MessageManager.RegisterMessageHandler<ChatMessage>(OnChatMessage);
```

Unregister the same delegate instance with `UnregisterMessageHandler<T0>` when you stop listening.

## Sending a message

```csharp
public void Connection.SendMessage<T0>(Channel channel, T0 data) where T0 : IMessage, new();
```

This sends `data` to that one `Connection`, on the given `Channel`. It is never delivered back to the sender, even when the sender and receiver are the same peer's own other half (a host talking to itself is delivered in process, not echoed).

## Reading MessageContext

```csharp
public readonly struct MessageContext
{
    public readonly Channel Channel;
    public readonly Connection SenderConnection;
    public bool IsSenderServer => SenderConnection.IsServer;
}
```

- `Channel` — the channel the message travelled on.
- `SenderConnection` — the peer that sent it. **Never null**, unlike a call's `RpcContext.SenderConnection`: every message reaches a handler either off a link, where the receive pass names the connection it arrived on, or through this peer's own loopback delivery, which resolves the connection the receiving half would have seen.
- `IsSenderServer` — whether the server sent this. On a host, this is the only honest way to tell which half a message is from: a host is both roles at once, so its own `TransportManager.IsServerStarted` says nothing about any particular message.

## What happens when the type's hash is refused

A type needs no registration to be sent: its wire hash is worked out from its full name. `SendMessage<T0>` looks that hash up before anything else, ahead of the loopback branch. If the hash is refused, because another message type this peer has used hashes to the same value or the type has no full name, it logs an error and returns without sending, on every peer alike, host included. There is no quiet no-op on any one peer. See [Messages and Calls That Do Not Arrive](./messaging-troubleshooting.md) for the fix.

Separately, the receiving side gates on authentication: if `IsAuthenticationRequired` is `true` and the sender isn't authenticated, the message is refused and the sender is disconnected through `ServerManager.KickClient`, not merely dropped.
