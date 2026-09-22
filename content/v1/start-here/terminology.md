---
title: "Terminology"
---

## Roles and peers

A **server** is the peer that decides what is true. A **client** is a peer that connects to a server to play. A **host** is a single peer that is both: it runs a server and a client together, so the person running it plays too.

Three properties on `TransportManager` answer which of these the local peer is:

- `IsServerStarted` — a server connection is established.
- `IsClientStarted` — an authenticated client connection is established.
- `IsHostStarted` — both of the above are true at once.

`Invoker` is a separate, smaller idea: a byte enum, `Invoker.Client = 0` and `Invoker.Server = 1`, used wherever code has to say which role an operation acts for rather than what the local peer is. A host holds a connection for each role, and APIs like `TransportManager.TryGetConnection` take an `Invoker` to say which one they mean:

```csharp
public enum Invoker : byte
{
    Client = 0,
    Server = 1,
}
```

## The replicated things

- **NetworkSystem** — the replicated entity. It holds NetworkComponents, is created and destroyed as a unit, and is what spawns, despawns, and is observed.
- **NetworkComponent** — a container of replicated data attached to a NetworkSystem. Your own code writes NetworkComponent subclasses to declare what a system replicates.
- **NetworkMember<T0>** — one replicated value inside a NetworkComponent, declared as a field:

```csharp
public readonly NetworkMember<int> X = new();
```

- **NetworkSystemGroup** — groups several NetworkSystems so they spawn and despawn together, as one object, rather than each resolving interest on its own.

## Control, not ownership

Nucleus says **controller** where other engines say owner. `ControllerType` is a flags enum naming who controls a system:

```csharp
[System.Flags]
public enum ControllerType : byte
{
    None = 0,
    Server = 1 << 0,
    Client = 1 << 1,
    AnyController = Server | Client,
}
```

`NetworkSystem.IsController(ControllerType controllerType)` is the canonical "do I control this" check, true when the local peer is the server and no client controls the system (`ControllerType.Server`), or when the local peer is the controlling client (`ControllerType.Client`).

Control is server-assigned. Only the server can call `NetworkSystem.SetController(Connection controllingClientConnection)` — passing `null` returns control to the server. The system's current controlling client, or `null` when the server controls it, is exposed as `NetworkSystem.ControllingClient`.

## Connection and its identity

**Connection** is Nucleus's object for the link to one peer. `Connection.Id` is a `uint`, recycled once the connection it named disconnects — the next peer to connect can be handed the same id.

**ConnectionHandle** is what a game holds onto instead, when it needs to remember a peer for longer than that peer's link lasts. It is a small readonly struct:

```csharp
public readonly struct ConnectionHandle
{
    public readonly uint Id;
    public readonly uint Generation;
}
```

`Generation` is what makes a stale handle fail rather than alias: identifier seven issued twice is two different handles, and only the current one resolves through `TransportManager.TryGetConnection(ConnectionHandle, out Connection)`. A bare `Connection.Id` is no better, because identifiers are recycled too — a recycled id can never resolve to whoever arrived next once it's wrapped in a handle.

## Time

- **Tick** — one step of the network clock, `NetworkLoopManager.Tick`. It starts at `FirstTick = 1` and counts up; it never starts at zero.
- **Tick rate** — `NetworkLoopManager.TickRate`, ticks per second, clamped between `MinimumTickRate` (5) and `MaximumTickRate` (128), defaulting to `DefaultTickRate` (30).
- **UnsetTick** — `NetworkLoopManager.UnsetTick = 0`, the sentinel meaning "no tick," chosen so no live tick can ever equal it.
- **Subtick** — `NetworkLoopManager.SubtickPercentage`, the fraction of a tick (0 to 1) elapsed since the last one, used to smooth rendering between ticks rather than snapping to tick boundaries.

## Interest, observer and spawn

A peer **observes** a system when it has been registered to receive that system's updates. Observation is resolved by `InterestManager`, which tracks each connected client's observer registration across every started system, so replication cost scales with what a client can perceive rather than with the size of the world.

**Spawn** means a system begins replicating to a peer — its data starts being sent and the peer's local representation is created from it. It does not mean an engine object is instantiated; a system with no engine object at all still spawns and despawns in exactly this sense.

## Messages versus RPCs

A **message** is addressed to a peer: `Connection.SendMessage<T0>(Channel channel, T0 data) where T0 : IMessage, new()`.

An **RPC** is addressed to a NetworkSystem: `NetworkSystem.SendRpc<T0>(RpcTarget rpcTarget, Channel channel, T0 rpc, RpcSelfDelivery rpcSelfDelivery = RpcSelfDelivery.None) where T0 : IRpc, new()`. The `RpcTarget` (`Server`, `Observers`, or a specific connection) says who receives it; the system it's sent on says which replicated entity it concerns.

## Transport and channel

`Channel` says how data is sent:

```csharp
public enum Channel : byte
{
    Reliable = 0,
    Unreliable = 1,
}
```

`Channel.Reliable` is sent ordered and guaranteed to arrive; `Channel.Unreliable` is not.

## Scene handle versus scene id

Every scene load is additive, so the same scene asset can be opened more than once at a time, and two open copies need to be told apart. A `SceneLoadRequest` carries both:

- `SceneId` (`ushort`) — which scene asset.
- `SceneHandle` (`uint`) — which live, currently-open copy of it.

The id names the asset; only the handle names one particular loaded instance of it.
