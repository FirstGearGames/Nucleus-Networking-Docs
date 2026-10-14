---
title: "Sending client state from Unity"
---

> **Driving the core API directly?** See [Client state components](../../core-api/control/client-state-components.md)

A client state component is the one channel a client is allowed to push data upstream on: once per tick, the client that controls a system writes its intent, and the framework sends it to the server. This page builds one for a keyboard or gamepad and wires it into a MonoBehaviour.

## Declare the component

Subclass `NetworkClientStateComponent` and declare each piece of client state as a `NetworkMember<T0>` field. Register every member with `RegisterMember` from the constructor, before the component is ever added to a system:

```csharp
public class DriveClientStateComponent : NetworkClientStateComponent
{
    public Vector2 Direction
    {
        get => _direction.Value.ToUnity();
        set => _direction.Value = value.ToNative();
    }

    private readonly NetworkMember<NumericsVector2> _direction = new();

    public DriveClientStateComponent() => RegisterMember(_direction);
}
```

`RegisterMember` only queues the member. `Initialize` is what wires it for per-tick ring history, and it rings each registered member at whichever is larger: the member's own ring depth, or `SystemManager.PredictionHistoryTicks`, the system-wide prediction history. A client state member therefore always reaches back far enough for a replay to address every rewindable tick's client state, even if you never touch its ring depth yourself.

Do not override `Write` or `Read` for a component whose client state is held entirely in members. The base implementation writes and reads every registered member, in registration order, through each member's own encoding, and that pairing is what keeps the two sides from drifting apart. Override them only for a piece of client state that genuinely is not a member, and then:

- Override *both*, or the two sides read different numbers of bits and the stream misaligns for the rest of the packet.
- Call `base.Write` / `base.Read` if the override still wants its registered members serialized. **An override replaces the default rather than adding to it.** A `Write`/`Read` pair that skips the base call silently declares a zero-bit body: there's no exception, no log, nothing on the wire to read back. The whole channel just goes quiet, and the failure looks like the client state was never sent rather than like a coding mistake.

## Attach and retrieve it

Add the component once the system has linked — inside `OnSystemLinked` on a `NucleusBehaviour<T0>`, or the marker's own link event:

```csharp
private DriveClientStateComponent _driveClientState;

protected override void OnSystemLinked()
{
    _driveClientState = NetworkSystem.AddClientStateComponent<DriveClientStateComponent>();
    _driveClientState.ClientStateReceived += OnClientStateReceived;
}
```

Elsewhere, retrieve the same instance with `TryGetClientStateComponent<T0>`:

```csharp
if (networkSystem.TryGetClientStateComponent<DriveClientStateComponent>(out DriveClientStateComponent driveClientState))
{
    // use driveClientState
}
```

## Fill it from Update, not a tick callback

Write the controlling client's fields from Unity's `Update`, not from a tick-aligned loop-step override such as `OnEarlyStateUpdate`. A held key is a property of the frame, not an event, so it cannot arrive as a callback the way a tick step does; the read has to happen every rendered frame to see the key while it's down. The member ring still lands the value on the correct tick: whatever `Direction` holds when the framework serializes this tick's client state is what goes out.

```csharp
private void Update()
{
    if (NetworkSystem is null || _driveClientState is null)
        return;

    if (NetworkSystem.IsController(ControllerType.Client))
    {
        Vector3 direction = ReadDirectionFromKeyboard();
        _driveClientState.Direction = new(direction.x, direction.z);
    }
}
```

Only the controlling client should write; a system that isn't controlled locally has nothing to send.

## React to client state on the server

Subscribe to `ClientStateReceived(uint tick)` to act on the validated value. The fields already hold the (possibly corrected) value by the time the event fires:

```csharp
private void OnClientStateReceived(uint tick)
{
    Vector2 direction = _driveClientState.Direction;
    // apply direction to the object this tick controls
}
```

Unsubscribe in `OnSystemUnlinked` on a `NucleusBehaviour<T0>`, so a pooled or destroyed object doesn't keep a stale handler alive. It also runs when the behaviour is destroyed while still linked, so no `OnDestroy` backstop is needed:

```csharp
protected override void OnSystemUnlinked()
{
    if (_driveClientState is not null)
        _driveClientState.ClientStateReceived -= OnClientStateReceived;
}
```

## Forwarding and corrections

`ForwardingEnabled` (true by default) controls whether the server forwards this component's validated client state to the system's observers. When it's on, a remote observer receives the same values through its own `ClientStateReceived`, so presentation, such as audio and animation, can react to another player's actions. The controller itself doesn't receive its own client state back through `ClientStateReceived`; instead, if validation rejected or modified what it sent, the controller gets `ClientStateCorrected(uint tick)`, and the corrected values are already written into the client state members' ring history at that tick before the callback fires, so a later replay from that tick uses the validated client state.

Override `TryValidateState` on the server side to enforce game rules: mutate the fields to correct them and return whether the client state was accepted unchanged. Returning `false` is what triggers the forward to `ClientStateCorrected`.

For the serialization contract behind `Write`/`Read` and server-side validation in more depth, see [Client state components](../../core-api/control/client-state-components.md).
