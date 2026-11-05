---
title: "Securing a server in Unity"
---

> **Driving the core API directly?** See [Securing a server](../../core-api/diagnostics/securing-a-server.md)

[Securing a server](../../core-api/diagnostics/securing-a-server.md#the-server-already-rejects-a-lot-on-its-own) lists what the server already rejects on its own, and applies to Unity unchanged. This page covers the settings you reach from an inspector or a Unity script. See also [What the server trusts](./what-the-server-trusts.md) and [Handling violations in Unity](./handling-violations-in-unity.md).

## Only a check on the server counts

A modified client can skip any check it holds, so every check here must run on the server, for example behind `IsStarted(Invoker.Server)` on a `NucleusBehaviour`. A client may run the same code only to predict an answer or grey out a button.

## Limit how much each client can send

Set limits on the transport wherever it supports them, and use the Unity Server Manager's limits for transports that do not. The transport drops traffic before the engine reads anything, which is cheaper and also protects the transport's own receive buffers.

### Set the client limits on the Synapse Transport component

The **Client Limits** section of the `SynapseTransport` inspector is **enabled by default**. The limits apply only while the peer runs a server, and a change takes effect at the next server start.

| Inspector field | Default | What it guards against |
|---|---|---|
| Client Limits Enabled | on | Turns every limit below on or off. The socket's other checks, such as refusing a datagram wider than the transmission unit, stay on either way. |
| Maximum Packets Per Second | `500` | A client sending too many datagrams. The excess is dropped rather than kicked, because the source address of a datagram can be forged. |
| Maximum Bytes Per Second | `2097152` (2 MiB) | A client sending too many bytes, enforced the same way as the packet rate. |
| Maximum Out Of Order Reliable Packets | `64` | A client pinning server memory by never filling a gap in its reliable stream. One past the limit kicks and blacklists the client. |
| Maximum Reassembled Packet Size | `0` (no limit) | A client declaring a huge split packet so the server sets memory aside to rebuild it. A client over it is kicked and blacklisted. |
| Maximum Segments | `0` (the protocol's limit of 255) | A packet split into too many pieces. A packet over it is dropped. It also caps what the server sends. |
| Maximum Concurrent Assemblies Per Connection | `16` | A client opening many split packets at once. One more evicts or drops a piece. |

Zero turns a single limit off. The fields show only while Client Limits Enabled is ticked.

The packet rate is the tighter of the two rates by default. If an honest client loses input under load, for example because it controls many objects or the server runs a high tick rate, raise Maximum Packets Per Second first. Dropped datagrams show up as lost client state, not as a kick.

In the **Hosting** section, **Maximum Connections** defaults to `0`, which accepts any number of clients. Set it to what your server can carry.

To see what the socket refused, subscribe to `ViolationObserved` on the `Synapse` transport the component built. It reports rate limits, oversized packets, security kicks and timeouts. See [Synapse](../../core-api/transports/synapse-transport.md#finding-out-why-a-connection-dropped) and [SynapseTransport component](../transports/synapse-transport-component.md).

### Turn on the Unity Server Manager's limits for transports without their own

The **Client Limits** section of the `UnityServerManager` inspector is **disabled by default**. These limits are checked on every packet a client sends, whatever the transport. Turn them on for a transport with no limits of its own, such as `BlitzRelayTransport`, or as a second line behind Synapse's.

| Inspector field | Default | What it guards against |
|---|---|---|
| Client Limits Enabled | off | Turns the engine limits on. While it is off, nothing is counted. |
| Maximum Packet Bytes | `0` (no limit) | A client sending oversized packets. Keep it at least one transmission unit above the largest packet an honest client sends. |
| Maximum Packets Per Second | `500` | A client sending too many packets in one second. |
| Maximum Bytes Per Second | `2097152` (2 MiB) | A client sending too many bytes in one second. |

A packet past a limit is discarded unread and raises `ClientLimitViolation`, which **kicks by default**. A host's own client is exempt. The fields show only while Client Limits Enabled is ticked.

To change the limits from a script, set `UnityServerManager.ClientLimits` at any time. Once the managers are built, the change applies straight away.

## Set the rest of the server's defences from a script

These settings have no inspector field. Set them through `NucleusUnity.BoundCoreManager` from `Start`, not `Awake` (see [Handling violations in Unity](./handling-violations-in-unity.md#registering-at-the-right-time)):

```csharp
public class ServerSecurity : MonoBehaviour
{
    private void Start()
    {
        CoreManager coreManager = NucleusUnity.BoundCoreManager;

        coreManager.ServerManager.SetAuthenticator(new TokenClientAuthenticator(coreManager.MessageManager));
        coreManager.ServerManager.AuthenticationTimeoutSeconds = 15;
        coreManager.RpcManager.MaximumInboundRpcsPerConnectionPerDrain = 32;
        coreManager.ViolationManager.RegisterViolationHandler<RpcFloodViolation>(OnRpcFlood);
    }

    private ViolationAction OnRpcFlood(ref ViolationContext<RpcFloodViolation> context) => ViolationAction.Kick;
}
```

`TokenClientAuthenticator` stands for your own type. Unregister handlers in `OnDestroy`, as [Handling violations in Unity](./handling-violations-in-unity.md#unregistering-in-ondestroy) explains.

| Setting | Default | What it guards against | More |
|---|---|---|---|
| `ServerManager.SetAuthenticator` | `AddressClientAuthenticator`, which approves everyone | Strangers joining a public server. Install your own before the server starts listening. | [Authenticating clients](../../core-api/core/authentication.md) |
| `ServerManager.AuthenticationTimeoutSeconds` | `30` | A client holding a slot open without ever authenticating. Zero disables it. | [Authenticating clients](../../core-api/core/authentication.md#timeout) |
| `ServerManager.KickTimeoutMilliseconds` | `500` | A kicked client that never acknowledges, keeping its link open. | [Kicking and disconnecting a client](../../core-api/core/kicking-and-disconnecting.md) |
| `RpcManager.MaximumInboundRpcsPerConnectionPerDrain` | `64` | A client packing many remote calls together to cost the server work. | [Who may send a call, and how many](../../core-api/messaging/rpc-send-access.md#capping-calls-per-drain) |
| `SystemManager.PredictedSpawnValidator` (Pro) | none, so every predicted spawn is refused | A client creating objects it should not. | [Client-predicted spawning in Unity](../systems/predicted-spawning.md) |

The one related setting with an inspector field is **Scene Load Timeout (s)** on the `UnitySceneManager` (180 by default). It gives up on a scene load a client never answers.

## Lock down who may set members and send calls

By default only the server and the controlling client may set a `NetworkSystem`'s members (`MemberWriteAccess.Controller`) or send it remote calls (`RpcSendAccess.Controller`). Neither has an inspector field. Only the server can widen them, from a `NucleusBehaviour` through its `NetworkSystem` property:

```csharp
if (IsStarted(Invoker.Server))
    NetworkSystem.TrySetRpcAccess(RpcSendAccess.AnyClient);
```

**Widen access only where every nearby player needs it,** such as a door anyone may open. `MemberWriteAccess.AnyClient` and `TrySetWriteAccess` are Pro. See [Letting clients set members](../../core-api/state/state-write-access.md) and [Who may send a call, and how many](../../core-api/messaging/rpc-send-access.md).

### Validate every value a client is allowed to write

Access decides whether a client may write, not whether the value makes sense. Implement `IMemberWriteValidator<T0>` on the `NetworkComponent` that owns the member and return `MemberWriteAction.Decline` for anything the game should not accept. It runs on the server only, and a validator that throws declines the write. This includes the per-tick input a controlling client sends. See [Using prediction](../control/using-prediction.md) for an input example and [Judging and arbitrating client writes](../../core-api/state/validating-client-writes.md) for the full contract.

### Check the sender and arguments of every remote call

A server handler can trust `RpcContext.SenderConnection`, which the transport resolved, and nothing else the client sent. Check each argument against what the server knows, and return `RpcRelayAction.Cancel` to stop a call reaching other clients. See [Judging and refusing a relayed call](../../core-api/messaging/rpc-relay-and-moderation.md).

## Decide what each violation costs the client

Most violations are rejected silently and never kick. On the build that runs the server:

1. Register a deciding handler that kicks for the faults an honest client cannot produce.
2. For faults an honest client can reach through loss or a race, count raises per connection before kicking.
3. Register an `IViolationObserver` that logs everything.

See [Decide what each violation costs the client](../../core-api/diagnostics/securing-a-server.md#decide-what-each-violation-costs-the-client) for worked handlers and the [Violation reference](./violation-reference.md) for each type.

## Leave server-only code out of client builds

Unity defines `UNITY_SERVER` when it builds for the Dedicated Server platform. Code wrapped in it is left out of client builds, so players cannot read your validation rules, cheat thresholds or loot tables from the game files. This hides your checks; it does not make them stronger. Wrap the server-only logic, such as a call handler and its registration:

```csharp
public class ScoreBoard : NucleusBehaviour<ScoreComponent>
{
    protected override void OnSystemLinked()
    {
#if UNITY_SERVER || UNITY_EDITOR
        NetworkSystem.RegisterRpcHandler<AddScoreRpc>(OnAddScore);
#endif
    }

#if UNITY_SERVER || UNITY_EDITOR
    private RpcRelayAction OnAddScore(in RpcContext rpcContext, AddScoreRpc rpc)
    {
        if (rpc.Amount is < 1 or > 10)
            return RpcRelayAction.Cancel;

        Component.Score.Value += rpc.Amount;

        return RpcRelayAction.Relay;
    }
#endif
}
```

- **Keep everything networked the same in both builds.** Never wrap a `NucleusBehaviour` or `NetworkComponent` class, a member, or a `[NetworkType]` type, including a call or message only the server handles. Both builds must agree on every networked type, or the server reads the client's data as a forged packet and raises `MalformedDataViolation`.
- **Add `UNITY_EDITOR` to the condition** so the server code stays in the editor, where you play-test as the server whatever the build platform.
- **Use it only when every server is a dedicated server.** A build without the server code cannot host, so a game whose players host needs the code in every build that can host.

## Check this list before you ship a server

- The Synapse Transport's Client Limits Enabled is ticked, with rates that suit your game.
- Any transport without its own limits is covered by the Unity Server Manager's client limits, with Maximum Packet Bytes set.
- Maximum Connections on the transport is above zero.
- Your own authenticator replaces `AddressClientAuthenticator`, and `AuthenticationTimeoutSeconds` is above zero.
- Only the login message sets `IsAuthenticationRequired` to `false`.
- Every object on `AnyClient` access is there on purpose.
- Every component with members a client can write, input included, implements `IMemberWriteValidator<T0>`.
- Every server call handler that relays between clients returns `Cancel` for anything you would not show other players.
- Deciding handlers and an `IViolationObserver` are registered on the server build.
- The server runs a release build of Nucleus. A debug build ignores `MalformedDataViolation` instead of kicking for it.
