---
title: "Sending client state from Unity"
---

> **Driving the core API directly?** See [Client state](../../core-api/control/client-state-components.md)

Client state is the one kind of data a client sends upstream every tick: the client that controls an object writes what its player asked for (a move direction, a jump press), and the server simulates the object from it. This page sends a keyboard or gamepad direction from a `NucleusBehaviour` and moves the object on the server.

## Declare the client state in the component

Client state is ordinary `NetworkMember<T0>` fields with `role: MemberRole.Predict`, declared in the object's own `NetworkComponent` beside the state the server computes from them. There is no separate class to write, and nothing to add or register when the object links: the members travel because of their role.

```csharp
using Nucleus.Components;
using Nucleus.Connections;
using NumericsVector2 = System.Numerics.Vector2;
using NumericsVector3 = System.Numerics.Vector3;

namespace MyGame
{
    public partial class MoverComponent : NetworkComponent, IStateWriteValidator<NumericsVector2>, IStateWriteValidator<NumericsVector3>
    {
        // Client state: written by the controller on its live tick, sent upstream every tick.
        public readonly NetworkMember<NumericsVector2> Direction = new(role: MemberRole.Predict);
        // State only the server computes from it.
        public readonly NetworkMember<NumericsVector3> Position = new();

        // Runs on the server for each tick of client state it takes. Write the member and decline to keep your own value instead.
        public StateWriteAction ValidateStateWrite(NetworkMember<NumericsVector2> networkMember, NumericsVector2 proposedValue, Connection writingClientConnection)
        {
            float length = proposedValue.Length();

            if (length <= 1f)
                return StateWriteAction.Accept;

            Direction.Value = proposedValue / length;

            return StateWriteAction.Decline;
        }

        // Only the server moves this object, so a client write to the position is declined.
        public StateWriteAction ValidateStateWrite(NetworkMember<NumericsVector3> networkMember, NumericsVector3 proposedValue, Connection writingClientConnection) => StateWriteAction.Decline;
    }
}
```

The validator runs on the server once per Predict member for every client tick it takes: accept the value, decline it to keep what the member holds, or write the member and decline to keep your own, as the direction clamp does. A validator that throws declines. A press that must not repeat across a lost tick is declared with `isCarriedForward: false` (see below).

## Read the device in Update, write it on the tick

Read the keys from Unity's `Update`, into a field: a held key is a property of the frame, so it has to be read every rendered frame. Then copy that field into the Predict member inside `OnEarlyFixedUpdate`, on the controller's live tick only. That tick is `SimulationType.Forward`; a replay reads each past tick's value from the member's history and must never overwrite it.

```csharp
using Nucleus.Connections;
using Nucleus.Integrations.Unity.Serializers;
using Nucleus.Integrations.Unity.Systems;
using Nucleus.Managers.NetworkLoop;
using Nucleus.Systems;
using UnityEngine;

namespace MyGame
{
    public class ServerMover : NucleusBehaviour<MoverComponent>
    {
        [SerializeField] private float _speed = 5f;

        private Vector2 _frameDirection;

        protected override void OnSystemLinked()
        {
            if (IsStarted(Invoker.Server))
                Component.Position.Value = transform.position.ToNative();
            else
                transform.position = Component.Position.Value.ToUnity();
        }

        protected override void OnSystemUnlinked() => _frameDirection = Vector2.zero;

        private void Update()
        {
            // Replace with your project's input system.
            if (IsController(ControllerType.Client))
                _frameDirection = Vector2.ClampMagnitude(new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical")), 1f);
        }

        protected override void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext)
        {
            if (simulationContext.Type is SimulationType.None)
                return;

            // The controller's live tick: the keys become this tick's client state.
            if (simulationContext.Type is SimulationType.Forward && IsController(ControllerType.Client))
                Component.Direction.Value = _frameDirection.ToNative();

            if (!IsStarted(Invoker.Server))
                return;

            // A tick whose client state did not arrive: keep the last direction rather than stopping.
            if (stepDelta.IsClientStateMissing)
                Component.TryGetLastState(isEveryMemberCarried: true);

            Component.Position.Value = Step(Component.Position.Value.ToUnity(), Component.Direction.Value.ToUnity()).ToNative();
        }

        protected override void OnVariableUpdate(StepDelta stepDelta) => transform.position = Component.Position.InterpolatedValue.ToUnity();

        private Vector3 Step(Vector3 position, Vector2 direction)
        {
            float seconds = 1f / CoreManager.NetworkLoopManager.TickRate;

            return position + new Vector3(direction.x, 0f, direction.y) * (_speed * seconds);
        }
    }
}
```

Do not put a `NetworkTransform` on the same object; this script replicates the position itself. Step by the fixed tick (`1f / CoreManager.NetworkLoopManager.TickRate`), never `Time.deltaTime`, so every peer integrates identically.

## What the server does with it

A pure client sends its Predict members to the server every tick; a member that did not change costs one bit. The server takes one of the client's ticks per server tick, through **State Interpolation**, runs the validator, then runs the object's fixed updates with the members holding that tick's values. On a host playing its own object the host writes the members and steps with them in the same tick, so nothing travels upstream, but each value still goes through the same validator.

The object is stepped on every server tick, even when that tick's client state never arrived. On that step `stepDelta.IsClientStateMissing` is true and the Predict members read their defaults until the component's `TryGetLastState(isEveryMemberCarried)` carries the previous tick's. Declare a press with `isCarriedForward: false` so `TryGetLastState(false)` leaves it at its default, or send a running press count, which repeats nothing when carried. Late and dropped ticks are counted on the controller's `Connection` as `ClientStateLateCount` and `ClientStateDroppedCount`.

The server's step runs on the server's own tick (`stepDelta.Tick`). `simulationContext.RemoteTick` names the client's tick it is simulating, for logging and pairing only: never time a cooldown by it, since a client picks its own tick numbers.

## React to client state

The server forwards the values it kept, after validation and its own writes, to every observer of the object, the controller included. `OnMembersChanged` on the component reports them on change, not every tick:

- `MemberChangeDirection.Read` on the server when a client's changed value is taken (`TryGetWritingClient` names the sender), and on an observer receiving a changed value. Drive presentation such as footsteps or animation from it.
- `MemberChangeDirection.Correction` on the controller when the server's value for one of its past ticks differs from its own, as when the validator clamped it. The server's value is already in the member's history at that tick.

```csharp
public override void OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection)
{
    if (memberChangeDirection is MemberChangeDirection.Correction && (memberFlags & (ulong)MoverComponentFlags.Direction) != 0)
        UnityEngine.Debug.Log($"The server corrected the direction to {Direction.Value}.");
}
```

Put this override in `MoverComponent`. The simulation reads the members every tick anyway; use the callback for presentation or to react to a correction.

## Predict the result as well

Here only the server moves the object, so the controller sees its own movement a round trip late. To have it move at once, declare `Position` with `role: MemberRole.Validate`, run the step on the controller too, and let the engine replay it when the server finds the result different. See [Replaying a correction in Unity](./reconcile-in-unity.md).

For the server's side in more depth, see [Client state](../../core-api/control/client-state-components.md).
