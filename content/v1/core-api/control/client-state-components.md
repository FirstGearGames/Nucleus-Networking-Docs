---
title: "Client state components"
---

> **Using Unity?** See [Sending client state from Unity](../../unity/control/writing-a-client-state-component-unity.md).

## A client state component is a tick-aligned channel from the controlling client

A `NetworkClientStateComponent` is a tick-aligned client state channel attached to a `NetworkSystem`. Subclass it, declare the fields you want to send, and the framework serializes them upstream from the controlling client every tick. On the server, the deserialized values are validated before anything reacts to them, and validated client state can be forwarded back out to observers for presentation.

## Adding and retrieving a component

Add a component to a system with `NetworkSystem.AddClientStateComponent<T0>()`, where `T0 : NetworkClientStateComponent, new()`. It rents an instance from the type's pool, assigns it a slot, and initializes it against the owning system.

```csharp
public T0 AddClientStateComponent<T0>() where T0 : NetworkClientStateComponent, new()
```

Retrieve a previously added component by type with `TryGetClientStateComponent<T0>(out T0 component)`:

```csharp
public bool TryGetClientStateComponent<T0>(out T0 component) where T0 : NetworkClientStateComponent
```

Each component is stamped with a `byte Id` unique within its containing system, assigned as its slot index when added. `Id` is what identifies the component on the wire and in `FindClientStateComponent` lookups on receive.

## Declaring fields with RegisterMember

The declarative route is to expose client state fields as `NetworkMemberBase` members and register each one from the subclass constructor:

```csharp
protected void RegisterMember(NetworkMemberBase networkMember)
```

Call `RegisterMember` once per member before the system initializes the component. Each registered member is wired with a ring depth of at least `SystemManager.PredictionHistoryTicks` (or the member's own default ring depth, if that is larger), so a tick's value stays addressable for as long as a replay might need to walk back to it. Components built entirely from registered members need no `Write`/`Read` overrides at all — the default implementations serialize and deserialize every registered member, in registration order, through each member's own encoding.

## The Write / Read escape hatch

For client state that genuinely isn't a member, override the base serialization pair instead:

```csharp
public virtual void Write(Writer writer)
public virtual void Read(Reader reader)
```

An override **replaces** the default rather than adding to it. If you override `Write` or `Read` and still want registered members serialized, call `base.Write(writer)` / `base.Read(reader)` yourself — otherwise those members stop travelling over the wire. `Read` must consume exactly what `Write` produced, and in the same order.

## Validating client state on the server

Override `TryValidateState` on the server to enforce game rules against a tick's deserialized client state:

```csharp
protected virtual bool TryValidateState(uint tick) => true;
```

It runs after `Read` deserializes the fields and before `ClientStateReceived` fires. It may mutate the deserialized field values directly (a denied jump becomes `false`), and its return value reports whether the client state was accepted unchanged: `true` if nothing was touched, `false` if anything was rejected or modified. A `false` result queues a correction that is forwarded back to the controller.

## ClientStateReceived and ClientStateCorrected

```csharp
public event ClientStateReceivedHandler ClientStateReceived;   // delegate void ClientStateReceivedHandler(uint tick)
public event ClientStateCorrectedHandler ClientStateCorrected;  // delegate void ClientStateCorrectedHandler(uint tick)
```

`ClientStateReceived` fires whenever a client state payload has been applied to the fields: on the server after `TryValidateState` runs for the controller's tick, and on a remote observer after a forwarded, validated payload is applied. Read the fields inside the handler; they're already updated.

On a host, which is the server for the system it controls, `ClientStateReceived` is always raised for that tick. `ClientStateCorrected` is raised alongside it only when `TryValidateState` returned `false` for that tick — never unconditionally. On a remote (non-host) controller, `ClientStateCorrected` fires when the server forwards a correction, and the corrected values land in the member's ring history at the corrected tick so a later replay uses the validated client state.

## Forwarding to observers

```csharp
public bool ForwardingEnabled = true;
```

When `ForwardingEnabled` is true, the server includes the component in the forwarded client state subpacket sent to the system's delta observers each tick. Remote observers receive the validated values through their own `ClientStateReceived`, letting them drive presentation (audio, animation) from the controller's actions; the controller itself receives only the correction flag, surfaced through `ClientStateCorrected`. A component with `ForwardingEnabled` false is validated and raises events locally but is never sent to observers.

## Client state components are pooled, so they must reset themselves

`NetworkClientStateComponent` implements `IPoolResettable`:

```csharp
public virtual void OnRent() { }
public virtual void OnReturn()
```

`AddClientStateComponent<T0>` rents from the type's pool and wires the component's pool-return handler. `OnReturn` clears the component back to an unattached state — `NetworkSystem`/`CoreManager` cleared, `Id` reset, both events unsubscribed, `IsCorrectedThisTick` cleared, `ForwardingEnabled` reset to `true` — and returns every registered member to its own reset state. Override `OnRent` or `OnReturn` if a subclass adds state of its own that needs resetting, and call the base implementation.

## Controller-only, regardless of state write access

Client state is controller-only no matter what a system's state write access allows. A payload from any connection other than the registered controller is refused: its bits are still consumed off the wire so stream alignment isn't broken, but a `UncontrolledStateChangeViolation` is raised instead of the client state being applied.
