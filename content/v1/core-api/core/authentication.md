---
title: "Authenticating clients"
---

## Implement IClientAuthenticator

```csharp
public interface IClientAuthenticator
{
    void OnClientConnecting(Connection connection);
}
```

`OnClientConnecting` is called once per connecting client, when its remote connection is established and before it is authenticated. The engine defines no credential of its own: run whatever handshake you want with ordinary `IMessage` types, then call `ServerManager.ApproveClient` or `ServerManager.DenyClient`.

The verdict can come any number of ticks later, after a backend round trip. Until it does, the connection is unauthenticated: it is delivered no message that requires authentication, and it observes nothing.

## Call ApproveClient or DenyClient once you have a verdict

```csharp
void ApproveClient(Connection connection, string identity = null);
void DenyClient(Connection connection);
void DenyClient(Connection connection, ulong timeoutMilliseconds);
void DenyClient<T0>(Connection connection, T0 notice) where T0 : IMessage, new();
void DenyClient<T0>(Connection connection, T0 notice, ulong timeoutMilliseconds) where T0 : IMessage, new();
```

- `ApproveClient` marks the connection authenticated and stamps `identity` onto `Connection.Identity`, the value that names this client across reconnects. Pass `null` to leave it unidentified. What the identity means is up to your code; the engine only carries it.
- `DenyClient(connection)` refuses and disconnects the client, telling it nothing. That is the right default for a failed authentication: a refused peer is owed no explanation, and one can help an attacker.
- `DenyClient(connection, notice)` first sends a message of your own on the reliable channel, so the client knows why. Its type is how the client tells a refusal from any other disconnect. Leave its `IsAuthenticationRequired` at the default; the refused client still receives it. A refusal is a kick, so the notice and the optional timeout behave as they do for [kicking a client](./kicking-and-disconnecting.md#telling-the-client-why).

Calls for a connection that is already resolved, or gone, are ignored.

## The default approves everyone by address

Until you install your own, `ServerManager` uses `AddressClientAuthenticator`:

```csharp
public sealed class AddressClientAuthenticator : IClientAuthenticator
{
    public void OnClientConnecting(Connection connection) =>
        connection.CoreManager.ServerManager.ApproveClient(connection, connection.RemoteAddress);
}
```

It approves every client at once and identifies it by `Connection.RemoteAddress`, which cannot be forged: a peer spoofing its source address never receives the return traffic and never completes a connection. The port is not part of it, so a client that reconnects from a new port still matches.

An address is a location, not a player. Clients behind one NAT (housemates, an office, a carrier-grade NAT) share an address and resolve to the same identity, so code that restores a returning player's objects by identity hands the second client the first one's. The default suits development, LAN and single-address deployments. Anything else needs your own authenticator.

## Install your own before the server starts listening

```csharp
void SetAuthenticator(IClientAuthenticator clientAuthenticator);
```

Call `ServerManager.SetAuthenticator` before the server starts listening. A client that connects earlier is resolved by whichever authenticator was in force at the time. Passing `null` restores `AddressClientAuthenticator`. In Unity there is no authenticator component; call it from a script once the managers exist.

## Timeout

```csharp
public ushort AuthenticationTimeoutSeconds = 30;
public const ushort UnsetAuthenticationTimeout = 0;
```

`ServerManager.AuthenticationTimeoutSeconds` (default 30) is how long a connecting client can stay unresolved, from when its remote connection is established, before the server disconnects it. Without it, a silent client or an authenticator that never reports would hold a connection slot open forever. It is checked once per tick, on `TickAdvance`. Set it to `UnsetAuthenticationTimeout` (0) to disable it.

## The server and client raise authentication events

On the server, `ServerManager` raises:

- `ClientAuthenticated(Connection connection)`: after the client is marked authenticated and its `Identity` is stamped, so a handler can read both.
- `ClientAuthenticationDenied(Connection connection)`: for a client that was denied or timed out, never for one that merely dropped. It is raised before the client is disconnected.

On the client, `ClientManager` raises `LocalClientAuthenticated(Connection localClientConnection)` once this client's connection is authenticated. The client learns its server-assigned Id before any other state that might reference it.

## Authenticate with a token

The client presents a token in a message. Because the client is not authenticated yet when it sends it, the message must opt out of the default requirement:

```csharp
[NetworkType]
public struct TokenAuthentication : IMessage
{
    public bool IsAuthenticationRequired => false;

    public string Token;
}
```

`IMessage.IsAuthenticationRequired` defaults to `true`. A type that forgets the override is refused from every unauthenticated sender, including the client trying to authenticate with it.

```csharp
public sealed class TokenClientAuthenticator : IClientAuthenticator
{
    public TokenClientAuthenticator(MessageManager messageManager)
    {
        messageManager.RegisterMessageHandler<TokenAuthentication>(OnTokenAuthentication);
    }

    public void OnClientConnecting(Connection connection)
    {
        // Nothing to do yet; wait for the client to present its token.
    }

    private void OnTokenAuthentication(in MessageContext messageContext, TokenAuthentication tokenAuthentication)
    {
        Connection connection = messageContext.SenderConnection;

        if (TryResolveIdentity(tokenAuthentication.Token, out string identity))
            connection.CoreManager.ServerManager.ApproveClient(connection, identity);
        else
            connection.CoreManager.ServerManager.DenyClient(connection, new TokenRefusedNotice { Reason = "Invalid token." });
    }
}
```

The refusal notice is an ordinary message, and the client registers an ordinary handler for it to show the reason:

```csharp
[NetworkType]
public struct TokenRefusedNotice : IMessage
{
    public string Reason;
}
```

The client sends `TokenAuthentication` on its own connection as soon as it connects. The token is a bearer credential: until the transport is encrypted it can be read off the wire and replayed. Make it:

- server-generated and unguessable;
- opaque about the identity it maps to;
- validated against server-held state, so an unrecognized value fails closed onto a fresh identity rather than an assumed one;
- expired or rotated on use.
