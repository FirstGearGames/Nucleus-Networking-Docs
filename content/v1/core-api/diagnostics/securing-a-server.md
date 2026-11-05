---
title: "Securing a server"
---

> **Using Unity?** See [Securing a server in Unity](../../unity/diagnostics/securing-a-server-in-unity.md)

This guide covers what the server already rejects and each setting and callback you can use to tighten it. [What the server trusts](./what-the-server-trusts.md) explains the trust model, and [Violations](./violations.md) explains how violations are decided and reported.

## Only a check on the server counts

Every check in this guide runs on the server. A client can run the same code to predict an answer or grey out a button, but a modified client can skip any check it holds.

## The server already rejects a lot on its own

The server refuses all of the following without any code from you. The offending data is thrown away and never applied, whatever you later decide about the client.

- **A client must observe a system to touch it.** A write or remote call aimed at a system the client does not observe is refused, so a client cannot reach an object by guessing its id. See [What the server trusts](./what-the-server-trusts.md#observation-gates-everything).
- **Only the controller may set a system's members unless you widen it.** A member value from a client that does not control the system is dropped and raises `UnauthorizedMemberChangeViolation`.
- **Only permitted clients may send a remote call.** A call from a client the system's `RpcSendAccess` does not admit is dropped and raises `RpcSendPermissionViolation`.
- **A client cannot pose as someone else.** The sender a handler is given is the connection the transport resolved for the packet, never an id the client wrote into it.
- **Data the server cannot read gets the client kicked in a release build.** The data is discarded and `MalformedDataViolation` is raised, which defaults to `Kick` in a release build. A debug build ignores it and logs the exception instead, so a serializer you are still writing does not keep kicking you.
- **An unauthenticated client may only send messages that opt out of authentication.** A message type requires authentication unless it sets `IsAuthenticationRequired` to `false`. A client that sends any other message before it is approved is kicked.
- **A client that never finishes authenticating is dropped.** `ServerManager.AuthenticationTimeoutSeconds` (30 by default) disconnects a client that stays unapproved that long.
- **Answers the server never asked for get the client kicked.** A client that sends a scene or bundle request, or reports a scene or bundle load the server never requested, raises one of the four protocol-direction violations, which default to `Kick`. See [Violation reference](./violation-reference.md#protocol-direction-violations).
- **A client cannot stall a scene load forever.** `SceneManager.LoadRequestTimeoutSeconds` (180 by default) gives up on a load a client never answers.
- **Remote calls are capped per drain.** `RpcManager.MaximumInboundRpcsPerConnectionPerDrain` (64 by default) drops calls past the cap and raises `RpcFloodViolation`.
- **Requests to repair lost state are capped.** A client may ask for at most four repairs per tick. The excess is refused with `StateLossReportFloodViolation`. A report sent to a peer that serves it no state is discarded with `UnexpectedStateLossReportViolation`.
- **Repair traffic is budgeted.** With `SystemManager.RecoveryBudgetEnabled` on (the default), a client that keeps losing packets, or claims to, is not repaired past its budget. `RecoveryBudgetExhaustedViolation` tells you when a client keeps hitting it.
- **A lag-compensated shot cannot ask for an arbitrarily old world.** In Pro, a shooter's claimed view is clamped to `LagCompensationManager.MaximumRewindMilliseconds` (500 by default) and raises `LagCompensationViewClampedViolation`. See [The rewind window and the view clamp](../lag-compensation/the-rewind-window.md).
- **Predicted spawns are refused until you allow them.** In Pro, no client can predict a spawn or despawn until the server registers a validator, and the rate is bounded by `SystemManager.PredictedSystemsPerSecond` (100 by default). See [Predicted spawn and despawn requests](../systems/predicted-spawn-requests.md).

The server does not encrypt traffic. For that, use the Pro packet transform layer. See [Packet transforms](../transports/packet-transforms.md).

## Most violations are silent until you act on them

Most of the faults above neither kick nor log, because an honest client on a bad connection can raise many of them.

| Default | Violations |
|---|---|
| `Kick` | `MalformedDataViolation` (release builds), `ClientLimitViolation`, the four scene and bundle protocol-direction violations, and in Pro `UnsolicitedLeaseAcknowledgementViolation` |
| `Ignore` | Everything else, including `UnauthorizedMemberChangeViolation`, `RpcSendPermissionViolation`, `RpcFloodViolation` and `StateLossReportFloodViolation` |

Deciding which ignored violations deserve a kick in your game is the main security work. See [Decide what each violation costs the client](#decide-what-each-violation-costs-the-client).

## Limit how much each client can send

A flooding client costs the server CPU and memory even when every packet is rejected. Use the transport's limits first and the engine's limits as a fallback.

### Configure limits on the transport first

Transport limits drop traffic before the engine reads it, and also protect the transport's own receive buffers.

The Synapse transport's limits are on `Synapse.ClientLimits`, a `SynapseClientLimits`. **They are enabled by default.** They apply only on a server. Set them before the server starts.

| Field | Default | What it guards against |
|---|---|---|
| `Enabled` | `true` | Turns every limit below on or off. The socket's other checks, such as refusing a datagram wider than the transmission unit, stay on either way. |
| `MaximumPacketsPerSecond` | `500` | A client sending too many datagrams. The excess is dropped rather than kicked, because a datagram's source address can be forged. |
| `MaximumBytesPerSecond` | 2 MiB | A client sending too many bytes. Enforced like the packet rate, over the same one-second window. |
| `MaximumOutOfOrderReliablePackets` | `64` | A client pinning server memory by never filling a gap in its reliable stream. One past the limit kicks and blacklists the client. |
| `MaximumReassembledPacketSize` | `0` (no limit) | A client declaring a huge split packet. It is checked on the first piece, and a client over it is kicked and blacklisted. |
| `MaximumSegments` | `0` (the protocol's limit of 255) | A packet split into too many pieces. A packet over it is dropped without a violation. It also caps what the server sends. |
| `MaximumConcurrentAssembliesPerConnection` | `16` | A client opening many split packets at once. One more evicts the oldest unfinished unreliable packet, or is dropped. |

Set a single limit to `SynapseClientLimits.UnsetLimit` (`0`) to turn it off.

If an honest client loses input under load, for example because it controls many objects or the server runs a high tick rate, raise `MaximumPacketsPerSecond` first. Dropped datagrams show up as lost client state, not as a kick.

To see what the socket refused, subscribe to `Synapse.ViolationObserved`. It reports rate limits, oversized packets, security kicks and timeouts. A handler must not block or disconnect anyone. See [Finding out why a connection dropped](../transports/synapse-transport.md#finding-out-why-a-connection-dropped).

### Use the engine limits as a fallback

Use `ServerManager.ClientLimits` for a transport without limits of its own, or as a second line behind one. The engine checks them on every packet a client sends, whatever the transport. They cannot protect the transport itself, but they stop every engine-side read and dispatch of a packet past a limit.

`ServerManager.ClientLimits` is a `ClientLimits` struct. **It is disabled by default.**

| Field | Default | What it guards against |
|---|---|---|
| `Enabled` | `false` | Turns the engine limits on. While it is off, nothing is counted. |
| `MaximumPacketBytes` | `0` (no limit) | Oversized packets, including each piece of a large packet the engine splits. Set it at least one transmission unit above the largest packet an honest client sends, since the last piece of a split packet is usually shorter. |
| `MaximumPacketsPerSecond` | `500` | Too many packets in one second. |
| `MaximumBytesPerSecond` | 2 MiB | Too many bytes in one second. |

A packet past a limit is discarded unread and raises `ClientLimitViolation`, which **kicks by default**. A rate limit raises it once per one-second window and discards the rest of the client's packets in that window. A host's own client is exempt.

Copy the struct out, change it and assign it back. A change takes effect straight away.

```csharp
ClientLimits clientLimits = coreManager.ServerManager.ClientLimits;
clientLimits.Enabled = true;
clientLimits.MaximumPacketBytes = 64 * 1024;
coreManager.ServerManager.ClientLimits = clientLimits;
```

### Cap the number of connections

A server accepts any number of clients until you call `SetMaximumConnections(uint)` on the transport. For Synapse it sets `ServerConfiguration.MaximumConnections`, where `0` (the default) means unlimited. A client beyond the cap is refused during its handshake.

## Authenticate every client before it can do anything

Until a client is approved it observes nothing and may only send messages that opt out of authentication. The shipped `AddressClientAuthenticator` approves everyone at once and identifies them by address, which suits development, not a public server.

1. Implement `IClientAuthenticator`.
2. Set it with `ServerManager.SetAuthenticator` before the server starts listening.
3. Call `ApproveClient` or `DenyClient` once you have a verdict. Use `DenyClient(connection)` without a notice for a failed login, since an explanation can help an attacker.
4. Keep `AuthenticationTimeoutSeconds` above zero so a client that never answers is dropped.

**Keep the message types that skip authentication few and small.** Anyone who can open a connection can send a message type with `IsAuthenticationRequired` set to `false`. Usually that is only the login message. Treat its contents as hostile, and remember that a token sent over an unencrypted transport can be read and replayed.

The server raises `ClientAuthenticated` and `ClientAuthenticationDenied` for logging or counting. See [Authenticating clients](../core/authentication.md).

## Lock down who may set members and send calls

Every `NetworkSystem` has two access values. Both default to the safest setting.

### Leave write access on the controller unless you need more

`MemberWriteAccess.Controller` is the default: only the server and the controlling client may set a system's members. `MemberWriteAccess.AnyClient` (Pro) lets any observer set them. Only the server can change it, through `NetworkSystem.TrySetWriteAccess`. A Free build has no write access setting, so only the controller can write. See [Letting clients set members](../state/state-write-access.md).

Open `AnyClient` only where every observer genuinely needs to write, and give each such system a validator.

### Leave send access on the controller unless you need more

`RpcSendAccess.Controller` is the default: only the server and the controlling client may send a system a remote call. `RpcSendAccess.AnyClient` lets any observer send one. Only the server can change it, through `NetworkSystem.TrySetRpcAccess`. See [Who may send a call, and how many](../messaging/rpc-send-access.md).

Open send access only for calls any nearby player should make, such as using a door or a shop, and treat every argument as hostile.

### Validate every value a client is allowed to write

Access decides whether a client may write. To check that the value makes sense, implement `IMemberWriteValidator<T0>` on the `NetworkComponent` that owns the member:

```csharp
public partial class InventoryComponent : NetworkComponent, IMemberWriteValidator<uint>
{
    private const uint SlotCount = 24;

    public readonly NetworkMember<uint> SelectedSlot = new();

    public MemberWriteAction ValidateMemberWrite(NetworkMember<uint> networkMember, uint proposedValue, Connection writingClientConnection) =>
        proposedValue < SlotCount ? MemberWriteAction.Accept : MemberWriteAction.Decline;
}
```

The validator runs on the server only, after the value is read and before it lands, so you can compare it against the current value through `networkMember.Value`. `Decline` keeps the old value, and other observers are never told about the rejected one. A validator that throws declines the write, so a value crafted to crash your check is not taken.

**Validate client state as well as replicated members.** The per-tick input a controlling client sends, in members declared with `MemberRole.Predict`, goes through the same validator. Clamp move directions, check that a jump is allowed, and decline anything a real controller could not produce. See [Judging and arbitrating client writes](../state/validating-client-writes.md) and [Client state components](../control/client-state-components.md).

A declined write is not a violation, and nothing is counted against the client. If a value can only come from a modified client, kick from inside the validator by calling `writingClientConnection.Kick()`.

## Judge remote calls on the server

### Check the sender and the arguments in the handler

A handler on the server receives an `RpcContext`. `RpcContext.SenderConnection` is the client that actually sent the call, resolved by the transport, so it is safe to use for permission checks and for cooldowns of your own. Check every argument against what the server knows: whether the sender is close enough to the door, owns the item, or has the money.

### Refuse to relay a call that should not reach other clients

Every server handler returns an `RpcRelayAction`. Return `RpcRelayAction.Cancel` to keep a call on the server instead of passing it on to the system's other observers. Any single `Cancel` wins, a later `Relay` cannot undo it, and a handler that throws counts as `Cancel`. Use this to moderate chat, emotes or anything else clients send each other through the server. See [Judging and refusing a relayed call](../messaging/rpc-relay-and-moderation.md).

### Tune the call cap to your game

`RpcManager.MaximumInboundRpcsPerConnectionPerDrain` (64 by default) bounds how many calls one client may deliver in a single drain. Lower it if your clients never send many calls at once. Setting it to `UnsetMaximumInboundRpcsPerConnectionPerDrain` (`0`) removes the cap, which a public server should not do.

## Decide what each violation costs the client

### Kick for faults an honest client cannot produce

Register a deciding handler for each violation type you want to escalate. A handler returns `ViolationAction.Kick` or `ViolationAction.Ignore`, and can set `context.Log` to log a line of its own:

```csharp
coreManager.ViolationManager.RegisterViolationHandler<RpcFloodViolation>((ref ViolationContext<RpcFloodViolation> context) =>
{
    context.Log = LogEntry.Warning($"Sent {context.Violation.ReceivedRpcCount} calls in one drain.");
    return ViolationAction.Kick;
});
```

There is one deciding handler per type, and registering another replaces it. A throwing handler falls back to the default action, so a bug in your handler does not let an offender escape a default kick.

### Count before you kick for faults an honest client can reach

`UnauthorizedMemberChangeViolation`, `RpcSendPermissionViolation`, `RetentionExceededViolation`, `StateLossReportFloodViolation` and several others can be raised once by an honest client through a race or a bad connection. Kicking on the first raise will drop real players. Instead, count raises per connection and kick only past a threshold you choose:

```csharp
private readonly Dictionary<uint, int> _permissionFaultCounts = new();

private ViolationAction OnRpcSendPermission(ref ViolationContext<RpcSendPermissionViolation> context)
{
    uint connectionId = context.Connection.Id;
    _permissionFaultCounts.TryGetValue(connectionId, out int count);
    _permissionFaultCounts[connectionId] = ++count;

    return count > 20 ? ViolationAction.Kick : ViolationAction.Ignore;
}
```

Clear a connection's count when it disconnects, since connection ids are reused. The [Violation reference](./violation-reference.md) lists each type with what to check before you assume an attack.

### Watch every violation for auditing

To log or report every violation without changing any outcome, implement `IViolationObserver` and register it with `ViolationManager.RegisterViolationObserver`. One observer hears every type. To watch a single type, subscribe to its event, such as `ViolationManager.ClientLimitViolationDetected`. Feed these into your own logs or anti-cheat reporting, so you can spot patterns no single violation reveals. See [Watching without deciding](./violations.md#watching-without-deciding).

A kick is only enforced on a peer that has started a server, so register deciding handlers in your server code.

## Kick cleanly when you remove a client

`ServerManager.KickClient` and the `Connection.Kick()` shorthand mark a client for removal. Under the default `KickOptions` the server immediately stops sending the client anything further and stops believing anything it sends, and the link closes at the end of the frame. Pass a notice message to tell the client why; the kick sends it first, so it is not dropped. `ServerManager.KickTimeoutMilliseconds` (500 by default) closes the link outright if the client never acknowledges. See [Kicking and disconnecting a client](../core/kicking-and-disconnecting.md).

## Check this list before you ship a server

- **The transport's own limits are on.** For Synapse, `Synapse.ClientLimits.Enabled` is `true` and the rates suit your game.
- **The engine limits cover any transport without limits of its own.** `ServerManager.ClientLimits.Enabled` is `true` for such a transport, with `MaximumPacketBytes` set.
- **The server has a connection cap.** `SetMaximumConnections` is set to what your hardware can carry.
- **Your own authenticator is installed.** `AddressClientAuthenticator` is replaced, and `AuthenticationTimeoutSeconds` is above zero.
- **Only the login message skips authentication.** Every other message type keeps `IsAuthenticationRequired` at `true`.
- **Access is widened only where it is needed.** Every system on `MemberWriteAccess.AnyClient` or `RpcSendAccess.AnyClient` is there on purpose.
- **Every value a client can write is validated.** Each component with members a client can write, client state included, implements `IMemberWriteValidator<T0>`.
- **Every server call handler checks its sender and arguments.** Handlers that relay between clients return `Cancel` for anything you would not show other players.
- **The violations you care about kick.** Deciding handlers escalate the faults an honest client cannot produce, and count the ones it can.
- **Violations are audited.** An `IViolationObserver` and a `Synapse.ViolationObserved` subscriber log what was refused.
- **The server runs a release build.** A debug build ignores `MalformedDataViolation` instead of kicking for it.
- **Sensitive bytes are protected.** If traffic must be encrypted, a packet transform is in place.
