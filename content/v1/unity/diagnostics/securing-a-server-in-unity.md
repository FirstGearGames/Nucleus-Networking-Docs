---
title: "Securing a server in Unity"
---

> **Driving the core API directly?** See [Securing a server](../../core-api/diagnostics/securing-a-server.md)

This guide covers what you can do in a Unity project to protect a Nucleus server from clients that misbehave, whether through a bug, a modified build or a deliberate attack. It names every security setting you can reach from an inspector, shows where the rest are set from a script, and ends with a checklist for shipping.

The full explanation of what the server already rejects on its own, and why most violations are silent by default, is in [Securing a server](../../core-api/diagnostics/securing-a-server.md#the-server-already-rejects-a-lot-on-its-own). Everything there applies to a Unity project unchanged. [What the server trusts](./what-the-server-trusts.md) and [Handling violations in Unity](./handling-violations-in-unity.md) sit beside this page.

## Only a check on the server counts

Every check in this guide runs on the server. A client build can run the same code to predict an answer or grey out a button, but a modified client can skip any check it holds. When this guide says "validate", it means validate in code that runs on the server, such as behind a check of `IsStarted(Invoker.Server)` on a `NucleusBehaviour`.

## Limit how much each client can send

Nucleus offers two layers of limits on what clients send. **Configure limits on the transport first wherever the transport supports them, and use the Unity Server Manager's limits as the fallback for transports that do not.** The transport sees each datagram the moment it arrives, before the engine has copied, read or dispatched anything, so dropping traffic there is earlier and cheaper. It also protects the transport's own receive buffers, which no engine-side check can reach.

### Set the client limits on the Synapse Transport component

The **Client Limits** section of the `SynapseTransport` inspector holds the socket's own limits. **They are enabled by default.** They apply only while the peer runs a server; a client never holds its server to them. A change is applied at the next server start.

| Inspector field | Default | What it guards against |
|---|---|---|
| Client Limits Enabled | on | Turns every limit below on or off. The socket's other checks, such as refusing a datagram wider than the transmission unit, stay on either way. |
| Maximum Packets Per Second | `500` | A client sending too many datagrams. The excess is dropped rather than kicked, because the source address of a datagram can be forged. |
| Maximum Bytes Per Second | `2097152` (2 MiB) | A client sending too many bytes, enforced the same way as the packet rate. |
| Maximum Out Of Order Reliable Packets | `64` | A client pinning server memory by never filling a gap in its reliable stream. One past the limit kicks and blacklists the client. |
| Maximum Reassembled Packet Size | `0` (no limit) | A client declaring a huge split packet so the server sets memory aside to rebuild it. A client over it is kicked and blacklisted. |
| Maximum Segments | `0` (the protocol's limit of 255) | A packet split into too many pieces. A packet over it is dropped. It also caps what the server sends. |
| Maximum Concurrent Assemblies Per Connection | `16` | A client opening many split packets at once. One more evicts or drops a piece. |

Zero turns a single limit off. The limits are drawn only while Client Limits Enabled is ticked.

The packet rate is the tighter of the two rates by default. If an honest client loses input under load, for example because it controls many objects or the server runs a high tick rate, raise Maximum Packets Per Second first. Dropped datagrams show up as lost client state rather than as a kick.

The **Hosting** section holds **Maximum Connections**, which defaults to `0` and accepts any number of clients. Set it to what your server can carry.

To see what the socket refused, subscribe to `ViolationObserved` on the `Synapse` transport the component built. It reports rate limits, oversized packets and security kicks as well as timeouts. See [Synapse](../../core-api/transports/synapse-transport.md#finding-out-why-a-connection-dropped) and [SynapseTransport component](../transports/synapse-transport-component.md).

### Turn on the Unity Server Manager's limits for transports without their own

The **Client Limits** section of the `UnityServerManager` inspector holds the engine's limits, which are checked on every packet a client sends whatever the transport is. **They are disabled by default.** Turn them on when your transport has no limits of its own, such as `BlitzRelayTransport`, or as a second line behind Synapse's.

| Inspector field | Default | What it guards against |
|---|---|---|
| Client Limits Enabled | off | Turns the engine limits on. While it is off, nothing is counted. |
| Maximum Packet Bytes | `0` (no limit) | A client sending oversized packets. Keep it at least one transmission unit above the largest packet an honest client sends. |
| Maximum Packets Per Second | `500` | A client sending too many packets in one second. |
| Maximum Bytes Per Second | `2097152` (2 MiB) | A client sending too many bytes in one second. |

A packet past a limit is discarded unread and raises `ClientLimitViolation`, which **kicks by default**. A host's own client is exempt. The limits are drawn only while Client Limits Enabled is ticked.

To change the limits from a script, set `UnityServerManager.ClientLimits`. It is accepted at any time, and once the managers are built it reaches the engine straight away.

## Set the rest of the server's defences from a script

Several security settings have no inspector field. Set them from a script once the managers exist, through `NucleusUnity.BoundCoreManager`. Do it from `Start`, not `Awake`, since `UnityCoreManager` builds the managers in its own `Awake` (see [Handling violations in Unity](./handling-violations-in-unity.md#registering-at-the-right-time)).

```csharp
public class ServerSecurity : MonoBehaviour
{
    private void Start()
    {
        CoreManager coreManager = NucleusUnity.BoundCoreManager;

        coreManager.ServerManager.SetAuthenticator(new TokenClientAuthenticator(coreManager.MessageManager));
        coreManager.ServerManager.AuthenticationTimeoutSeconds = 15;
        coreManager.RpcManager.MaximumInboundRpcsPerConnectionPerDrain = 32;
        coreManager.SceneManager.RegisterSceneLoadValidator(new TicketSceneLoadValidator());
        coreManager.ViolationManager.RegisterViolationHandler<RpcFloodViolation>(OnRpcFlood);
    }

    private ViolationAction OnRpcFlood(ref ViolationContext<RpcFloodViolation> context) => ViolationAction.Kick;
}
```

`TokenClientAuthenticator` and `TicketSceneLoadValidator` stand for your own types. Unregister handlers and validators in `OnDestroy`, as [Handling violations in Unity](./handling-violations-in-unity.md#unregistering-in-ondestroy) explains.

| Setting | Default | What it guards against | More |
|---|---|---|---|
| `ServerManager.SetAuthenticator` | `AddressClientAuthenticator`, which approves everyone | Strangers joining a public server. Install your own before the server starts listening. | [Authenticating clients](../../core-api/core/authentication.md) |
| `ServerManager.AuthenticationTimeoutSeconds` | `30` | A client holding a slot open without ever authenticating. Zero disables it. | [Authenticating clients](../../core-api/core/authentication.md#timeout) |
| `ServerManager.KickTimeoutMilliseconds` | `500` | A kicked client that never acknowledges, keeping its link open. | [Kicking and disconnecting a client](../../core-api/core/kicking-and-disconnecting.md) |
| `RpcManager.MaximumInboundRpcsPerConnectionPerDrain` | `64` | A client packing many remote calls together to cost the server work. | [Who may send a call, and how many](../../core-api/messaging/rpc-send-access.md#capping-calls-per-drain) |
| `SceneManager.RegisterSceneLoadValidator` | none registered | A client being placed in a scene it is not entitled to. | [Refusing a scene load](../../core-api/scenes/scene-load-validators.md) |
| `SystemManager.PredictedSpawnValidator` (Pro) | none, so every predicted spawn is refused | A client creating objects it should not. | [Client-predicted spawning in Unity](../systems/predicted-spawning.md) |

The **Scene Load Timeout (s)** field on the `UnitySceneManager` inspector (180 by default) is the one related setting that does have an inspector field. It gives up on a scene load a client never answers, so a client cannot stall a load forever.

## Lock down who may set members and send calls

Every networked object's `NetworkSystem` carries two access values, and both default to the safest setting: only the server and the controlling client may set its members (`MemberWriteAccess.Controller`) or send it remote calls (`RpcSendAccess.Controller`). Neither has an inspector field. Only the server can widen them, from a `NucleusBehaviour` through its `NetworkSystem` property:

```csharp
if (IsStarted(Invoker.Server))
    NetworkSystem.TrySetRpcAccess(RpcSendAccess.AnyClient);
```

**Widen access only where every nearby player genuinely needs it,** such as a door anyone may open. `MemberWriteAccess.AnyClient` and `TrySetWriteAccess` are Pro. See [Letting clients set members](../../core-api/state/state-write-access.md) and [Who may send a call, and how many](../../core-api/messaging/rpc-send-access.md).

### Validate every value a client is allowed to write

Access decides whether a client may write at all, not whether the value makes sense. Implement `IMemberWriteValidator<T0>` on the `NetworkComponent` that owns the member, and return `MemberWriteAction.Decline` for anything the game should not take. It runs on the server only, and a validator that throws declines the write. This includes the per-tick input a controlling client sends, which a modified client can fake as easily as anything else. See [Using prediction](../control/using-prediction.md) for an input example and [Judging and arbitrating client writes](../../core-api/state/validating-client-writes.md) for the full contract.

### Check the sender and arguments of every remote call

A server handler can trust `RpcContext.SenderConnection`, which the transport resolved, and nothing else the client sent. Check each argument against what the server knows, and return `RpcRelayAction.Cancel` to stop a call reaching other clients. See [Judging and refusing a relayed call](../../core-api/messaging/rpc-relay-and-moderation.md).

## Decide what each violation costs the client

Most violations are rejected silently and never kick. Register a deciding handler to kick for the faults an honest client cannot produce, count raises per connection before kicking for the ones it can reach through ordinary loss or a race, and register an `IViolationObserver` to log everything. Register handlers on the build that runs the server, since a kick decided on a client-only peer is never enforced. See [Decide what each violation costs the client](../../core-api/diagnostics/securing-a-server.md#decide-what-each-violation-costs-the-client) for worked handlers, [Handling violations in Unity](./handling-violations-in-unity.md) for Unity timing and cleanup, and the [Violation reference](./violation-reference.md) for each type.

## Check this list before you ship a server

- **The Synapse Transport's client limits are on.** Client Limits Enabled is ticked and the rates suit your game.
- **The Unity Server Manager's client limits cover any transport without its own.** Client Limits Enabled is ticked there for such a transport, with Maximum Packet Bytes set.
- **The server has a connection cap.** Maximum Connections on the transport is above zero.
- **Your own authenticator is installed from a script.** `AddressClientAuthenticator` is replaced, and `AuthenticationTimeoutSeconds` is above zero.
- **Only the login message skips authentication.** Every other message type keeps `IsAuthenticationRequired` at `true`.
- **Access is widened only where it is needed.** Every object on `AnyClient` access is there on purpose.
- **Every value a client can write is validated.** Each component with members a client can write, input included, implements `IMemberWriteValidator<T0>`.
- **Every server call handler checks its sender and arguments.** Handlers that relay between clients return `Cancel` for anything you would not show other players.
- **Scene entitlement is checked on the server.** An `ISceneLoadValidator` guards every scene that is not open to everyone.
- **The violations you care about kick, and all of them are logged.** Deciding handlers and an `IViolationObserver` are registered on the server build.
- **The server runs a release build of Nucleus.** A debug build ignores `MalformedDataViolation` instead of kicking for it.
