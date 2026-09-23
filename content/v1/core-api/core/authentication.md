---
title: "Authenticating clients"
---

## The contract

`IClientAuthenticator` has one member:

```csharp
public interface IClientAuthenticator
{
    void OnClientConnecting(Connection connection);
}
```

`OnClientConnecting` is called once per connecting client, when its remote connection is established and before it is authenticated. The engine defines no credential and no wire format of its own — an implementation drives whatever handshake it wants, using ordinary `IMessage` types, and reports the outcome by calling `ServerManager.ApproveClient` or `ServerManager.DenyClient`.

The decision does not have to be immediate. `OnClientConnecting` can return right away and the outcome can arrive any number of ticks later, after a backend round trip. Until it does, the connection stays unauthenticated: the engine delivers it no message that requires authentication, and it observes nothing.

## Deciding

Call one of these from anywhere in your authenticator once you've reached a verdict:

```csharp
void ApproveClient(Connection connection, string identity = null);
void DenyClient(Connection connection);
void DenyClient(Connection connection, string denialReason);
```

`ApproveClient` marks the connection authenticated and stamps `identity` onto `Connection.Identity`, the value that names this client across reconnects. Pass `null` to leave it unidentified. What the identity means, and how you correlate a returning peer with what it previously owned, is your code's business — the engine only carries the value.

`DenyClient(connection)` refuses the client and disconnects it, telling it nothing. That's the right default for a failed authentication: a refused peer is owed no explanation, and an explanation can help an attacker. `DenyClient(connection, denialReason)` delivers a reason over the reliable channel before disconnecting, if you want the client to know why.

A connection that's already resolved, or gone, is ignored by either call.

## The shipped default

Until you install your own, `ServerManager` uses `AddressClientAuthenticator`:

```csharp
public sealed class AddressClientAuthenticator : IClientAuthenticator
{
    public void OnClientConnecting(Connection connection) =>
        connection.CoreManager.ServerManager.ApproveClient(connection, connection.RemoteAddress);
}
```

It approves every client immediately and identifies it by `Connection.RemoteAddress` — the address the server observed it connecting from, which can't be forged, since a peer spoofing its source address never receives the return traffic and never completes a connection.

**An address is a location, not a player identity.** Two clients behind one NAT — housemates, an office, a carrier-grade NAT — connect from the same address and resolve to the same identity, so code that restores a returning player's objects by identity hands the second client the first one's. The port is deliberately left out of the identity, so a client that drops and reconnects from a new port still matches; including it would break every reconnect on the same network.

This is fine for development, LAN, and single-address deployments. Anything else needs an authenticator of your own.

## Installing your own

```csharp
void SetAuthenticator(IClientAuthenticator clientAuthenticator);
```

Set this before the server starts listening — a client that connects before it's set is resolved by whichever authenticator was in force at the time. Passing `null` restores `AddressClientAuthenticator`.

## Timeout

```csharp
public ushort AuthenticationTimeoutSeconds = 30;
public const ushort UnsetAuthenticationTimeout = 0;
```

`ServerManager.AuthenticationTimeoutSeconds` bounds how long a connecting client can go unresolved before the server disconnects it, measured from the moment its remote connection is established. The default is 30 seconds. A silent client, or an authenticator that never reports an outcome, would otherwise hold a connection slot open indefinitely.

The check runs once per tick, at the `LateTickUpdate` step. Set `AuthenticationTimeoutSeconds` to `UnsetAuthenticationTimeout` (0) to disable it.

## Events

On the server, `ServerManager` raises:

- `ClientAuthenticated(Connection connection)` — after the client is marked authenticated and its `Identity` is stamped, so a handler can read both.
- `ClientAuthenticationDenied(Connection connection, string denialReason)` — for a client that was denied or timed out, never for one that merely dropped its connection.

On the client, `ClientManager` raises:

- `LocalClientAuthenticated(Connection localClientConnection)` — once this client's connection is authenticated and carries its assigned Id.
- `LastAuthenticationDenialReason` — a `string` property holding the reason from the last denial, populated when the server sends one.

Approval sends the client an `AuthenticationResponse`, a reliable message carrying the `ClientId` the server assigned it — the Id the client learns itself by. It's sent before anything else, so the client knows its own identifier before any other state that might reference it.

## A worked example: token authentication

A token exchange needs a message type for the client to present its token, and an authenticator that validates it and calls `ApproveClient` or `DenyClient`. Since the client isn't authenticated yet when it sends this, the message must opt out of the default requirement:

```csharp
[NetworkType]
public struct TokenAuthentication : IMessage
{
    public bool IsAuthenticationRequired => false;

    public string Token;
}
```

`IMessage.IsAuthenticationRequired` defaults to `true`, so a message type says nothing unless it overrides it — a type that forgot the override would be refused from every unauthenticated sender, including the client trying to authenticate with it.

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
            connection.CoreManager.ServerManager.DenyClient(connection, "Invalid token.");
    }
}
```

The client sends its `TokenAuthentication` message on its own connection as soon as it connects. A token presented this way is a bearer credential: until the transport is encrypted it can be read off the wire and replayed, so it must be server-generated, unguessable, opaque about the identity it maps to, validated against server-held state so an unrecognized value fails closed onto a fresh identity rather than an assumed one, and expired or rotated on use.

## Unity

There is no authenticator component. Call `ServerManager.SetAuthenticator` from a script once the managers exist.
