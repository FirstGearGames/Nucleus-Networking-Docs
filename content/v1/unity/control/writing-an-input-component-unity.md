---
title: "Sending player input from Unity"
---

> **Driving the core API directly?** See [Input components](../../core-api/control/input-components)

An input component is the one channel a client is allowed to push data upstream on: once per tick, the client that controls a system writes its intent, and the framework sends it to the server. This page builds one for a keyboard or gamepad and wires it into a MonoBehaviour.

## Declare the component

Subclass `NetworkInputComponent` and declare each input as a `NetworkMember<T0>` field. Register every member with `RegisterMember` from the constructor, before the component is ever added to a system:

```csharp
public class DriveInputComponent : NetworkInputComponent
{
    public Vector2 Direction
    {
        get => _direction.Value.ToUnity();
        set => _direction.Value = value.ToNative();
    }

    private readonly NetworkMember<NumericsVector2> _direction = new();

    public DriveInputComponent() => RegisterMember(_direction);
}
```

`RegisterMember` only queues the member. `Initialize` is what wires it for per-tick ring history, and it rings each registered member at whichever is larger: the member's own ring depth, or `SystemManager.PredictionHistoryTicks`, the system-wide prediction history. An input member therefore always reaches back far enough for a replay to address every rewindable tick's inputs, even if you never touch its ring depth yourself.

Do not override `Write` or `Read` for a component whose inputs are all members. The base implementation writes and reads every registered member, in registration order, through each member's own encoding, and that pairing is what keeps the two sides from drifting apart. Override them only for an input that genuinely is not a member, and then:

- Override *both*, or the two sides read different numbers of bits and the stream misaligns for the rest of the packet.
- Call `base.Write` / `base.Read` if the override still wants its registered members serialized. **An override replaces the default rather than adding to it.** A `Write`/`Read` pair that skips the base call silently declares a zero-bit body: there's no exception, no log, nothing on the wire to read back — the whole channel just goes quiet, and the failure looks like the input was never sent rather than like a coding mistake.

## Attach and retrieve it

Add the component once the system has linked — inside `OnSystemLinked` on a `NucleusBehaviour<T0>`, or the marker's own link event:

```csharp
private DriveInputComponent _driveInput;

protected override void OnSystemLinked()
{
    _driveInput = NetworkSystem.AddInputComponent<DriveInputComponent>();
    _driveInput.InputReceived += OnInputReceived;
}
```

Elsewhere, retrieve the same instance with `TryGetInputComponent<T0>`:

```csharp
if (networkSystem.TryGetInputComponent<DriveInputComponent>(out DriveInputComponent driveInput))
{
    // use driveInput
}
```

## Fill it from Update, not a tick callback

Write the controlling client's fields from Unity's `Update`, not from a tick-aligned loop-step override such as `OnEarlyTickUpdate`. A held key is a property of the frame, not an event, so it cannot arrive as a callback the way a tick step does — the read has to happen every rendered frame to see the key while it's down. The member ring still lands the value on the correct tick: whatever `Direction` holds when the framework serializes this tick's input is what goes out.

```csharp
private void Update()
{
    if (NetworkSystem is null || _driveInput is null)
        return;

    if (NetworkSystem.IsController(ControllerType.Client))
    {
        Vector3 direction = ReadDirectionFromKeyboard();
        _driveInput.Direction = new(direction.x, direction.z);
    }
}
```

Only the controlling client should write; a system that isn't controlled locally has nothing to send.

## React to input on the server

Subscribe to `InputReceived(uint tick)` to act on the validated value. The fields already hold the (possibly corrected) value by the time the event fires:

```csharp
private void OnInputReceived(uint tick)
{
    Vector2 direction = _driveInput.Direction;
    // apply direction to the object this tick controls
}
```

Unsubscribe wherever the component's owning system goes away, so a pooled or destroyed object doesn't keep a stale handler alive — `OnSystemUnlinked` on a `NucleusBehaviour<T0>`, or `OnDestroy` as a backstop for a behaviour torn down while still linked:

```csharp
protected override void OnSystemUnlinked()
{
    if (_driveInput is not null)
        _driveInput.InputReceived -= OnInputReceived;
}
```

## Forwarding and corrections

`ForwardingEnabled` (true by default) controls whether the server forwards this component's validated inputs to the system's observers. When it's on, a remote observer receives the same values through its own `InputReceived`, so presentation — audio, animation — can react to another player's actions. The controller itself doesn't receive its own inputs back through `InputReceived`; instead, if validation rejected or modified what it sent, the controller gets `InputCorrected(uint tick)`, and the corrected values are already written into the input members' ring history at that tick before the callback fires, so a later replay from that tick uses the validated inputs.

Override `ValidateInputs` on the server side to enforce game rules — mutate the fields to correct them and return whether the input was accepted unchanged. Returning `false` is what triggers the forward to `InputCorrected`.

For the serialization contract behind `Write`/`Read` and server-side validation in more depth, see [Input components](../../core-api/control/input-components).
