---
title: "Sending client state from Unity"
---

> **Driving the core API directly?** See [Client state](../../core-api/control/client-state-components.md).

Client state is what the controlling client's player asked for this tick, such as a move direction or a jump press. The client sends it upstream every tick, and the server simulates the object from it. This page sends a direction from a `NucleusBehaviour` and moves the object on the server.

## Declare the client state in the component

Declare client state as `NetworkMember<T0>` fields with `role: MemberRole.Predict`, in the object's own `NetworkComponent` beside the members the server computes from them. There is nothing else to add or register.

```csharp
using Nucleus.Components;
using Nucleus.Connections;
using NumericsVector2 = System.Numerics.Vector2;
using NumericsVector3 = System.Numerics.Vector3;

namespace MyGame
{
    public partial class MoverComponent : NetworkComponent, IMemberWriteValidator<NumericsVector2>, IMemberWriteValidator<NumericsVector3>
    {
        // Client state: written by the controller on its live tick, sent upstream every tick.
        public readonly NetworkMember<NumericsVector2> Direction = new(role: MemberRole.Predict);
        // A member only the server computes from it.
        public readonly NetworkMember<NumericsVector3> Position = new();

        // Runs on the server for each tick of client state it takes. Write the member and decline to keep your own value instead.
        public MemberWriteAction ValidateMemberWrite(NetworkMember<NumericsVector2> networkMember, NumericsVector2 proposedValue, Connection writingClientConnection)
        {
            float length = proposedValue.Length();

            if (length <= 1f)
                return MemberWriteAction.Accept;

            Direction.Value = proposedValue / length;

            return MemberWriteAction.Decline;
        }

        // Only the server moves this object, so a client write to the position is declined.
        public MemberWriteAction ValidateMemberWrite(NetworkMember<NumericsVector3> networkMember, NumericsVector3 proposedValue, Connection writingClientConnection) => MemberWriteAction.Decline;
    }
}
```

The validator runs on the server once per `Predict` member for every client tick it takes. Return `Accept` to take the value, `Decline` to keep what the member holds, or write the member and return `Decline` to keep your own value, as the direction clamp does. A validator that throws declines.

## Read the device in Update, write it on the tick

Read the keys in `Update` into a field, since a held key belongs to the rendered frame. Copy the field into the `Predict` member in `OnEarlyFixedUpdate`, only on the controller's live tick (`SimulationType.Forward`). A replay reads each past tick's value from the member's history and must never overwrite it.

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

- Do not put a `NetworkTransform` on the same object; this script replicates the position itself.
- Step by the fixed tick (`1f / CoreManager.NetworkLoopManager.TickRate`), never `Time.deltaTime`, so every peer integrates identically.

## Handle client state that never arrived

The server steps the object on every server tick, one client tick at a time, through **State Interpolation**. On a host playing its own object nothing travels upstream, but each value still goes through the validator.

When a tick's client state never arrived, `stepDelta.IsClientStateMissing` is true and the `Predict` members read their defaults until `TryGetLastState(isEveryMemberCarried)` carries the previous tick's values.

- Declare a press as a bool with `isCarriedForward: false`, so `TryGetLastState(false)` leaves it at its default. A press lost with its packet is simply lost, and the server corrects the jump the client showed.
- `TryGetLastState(isEveryMemberCarried, out SimulationContext lastStateSimulationContext)` also reports which tick the carried state came from. On the server, `simulationContext.RemoteTick - lastStateSimulationContext.RemoteTick` is how many ticks it has been carried, for example to stop a character once the client has been silent too long.
- The controller's `Connection` counts late and dropped ticks as `ClientStateLateCount` and `ClientStateDroppedCount`.

The server's step runs on its own tick (`stepDelta.Tick`). Use `simulationContext.RemoteTick`, the client's tick being simulated, only for logging and pairing, never to time a cooldown: a client picks its own tick numbers.

## React to client state

The server forwards the values it kept, after validation and its own writes, to every observer, the controller included. `OnMembersChanged` on the component reports them when they change:

- `MemberChangeDirection.Read`: on the server when it takes a client's changed value (`TryGetWritingClient` names the sender), and on an observer receiving a changed value. Drive presentation such as footsteps or animation from it.
- `MemberChangeDirection.Correction`: on the controller, when the server's value for one of its past ticks differs from its own, as when the validator clamped it. The server's value is already in the member's history for that tick.

```csharp
public override void OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection)
{
    if (memberChangeDirection is MemberChangeDirection.Correction && (memberFlags & (ulong)MoverComponentFlags.Direction) != 0)
        UnityEngine.Debug.Log($"The server corrected the direction to {Direction.Value}.");
}
```

Put this override in `MoverComponent`. Use the callback for presentation or to react to a correction; the simulation reads the members every tick anyway.

## Predict the result as well

Here only the server moves the object, so the controller sees its own movement a round trip late. To move it at once, declare `Position` with `role: MemberRole.Validate`, run the step on the controller too, and let the engine replay it when the server's result differs. See [Replaying a correction in Unity](./reconcile-in-unity.md).
