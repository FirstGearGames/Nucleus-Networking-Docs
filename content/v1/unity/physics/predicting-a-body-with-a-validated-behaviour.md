---
title: "Predicting a body with a validated behaviour"
---

> **Driving the core API directly?** See [Predicted members and prediction history](../../core-api/control/prediction-history-and-predicted-members.md) and [Reconciliation and replay](../../core-api/control/reconciliation.md).

A validated behaviour lets the client that controls an object predict a Unity `Rigidbody`, transform or `CharacterController` from its own client state, while the server runs the same client state and checks the result. When the two disagree, the client is corrected and replays every tick since, physics included. You add the behaviour and write only the client state and the forces.

The `BallRacer` demo under `Demos/Tutorials` is the worked example: a ball a client steers left and right, with a local cheat key the server catches.

## Choose a validated behaviour when the client controls the body

- **A validated behaviour** suits a body the client controls outright, such as a player's own ball or vehicle. The server never takes the client's result, so it resists cheating with no extra code. Each correction costs a replay of the physics world, and physics is not exactly the same on every machine, so a rare correction is normal.
- **`NetworkRigidbody` with `Convergence.IsLocallyPredicted`** suits a body the server controls and simulates while one client steers it. The client never replays; its body eases toward the server's state over a few ticks. See [Driving a predicted body](./driving-a-predicted-body.md).

Choose a validated behaviour for competitive play where the player's own body must match the server's. Choose convergence when you would rather never pay for a replay and a softer correction is fine.

## Add one validated behaviour per Unity component

Each validated behaviour keeps the state of one Unity component in `MemberRole.Validate` members and declares a predicted system of its own for them, so your script does not list it in its composition.

The behaviours live in the `Nucleus.Integrations.Unity.Prediction` namespace:

| Behaviour | What it keeps | Notes |
| --- | --- | --- |
| `ValidatedTransform` | Position, rotation, scale, active state and layer. | **Transform Space** is World (the default) or Local; Local suits an object carried by a parent that is replicated itself. **Active State Apply Enabled** (off by default) applies the active state to the GameObject. |
| `ValidatedRigidbody` | Everything `ValidatedTransform` keeps, plus the velocities and whether the body is asleep. | Add `ValidatedRigidbodyAdvanced` beside it to also keep kinematic, collision detection, constraints and center of mass. |
| `ValidatedRigidbody2D` | The same for a `Rigidbody2D`. | `ValidatedRigidbody2DAdvanced` is the 2D version of the advanced settings. |
| `ValidatedCharacterController` | Everything `ValidatedTransform` keeps, plus whether the controller is enabled. | Add `ValidatedCharacterControllerAdvanced` for height, center and radius. A replay does not restore the controller's velocity, grounded flag or collision flags, so keep your own velocity and grounded state as members. |
| `ValidatedConstantForce`, `ValidatedConstantForce2D` | The force, relative force, torque and relative torque of a `ConstantForce`. | Add it beside the pushed body's `ValidatedRigidbody` or `ValidatedRigidbody2D`. |
| `ReconciledAnimator` | Every animator parameter and layer weight, on this peer only. | It is a `NetworkAnimator` that also puts back the parameters of the restored tick before a replay, so a mispredicted trigger or bool does not stick. Use it instead of `NetworkAnimator` on a predicted object. A client-authoritative object keeps the plain `NetworkAnimator`. |
| `ValidatedAnimator` | Up to 16 float, 16 int, 64 bool and 16 trigger parameters, 8 layer weights and the speed. | The server checks them, so use it when a parameter decides gameplay. Set parameters on the animator as usual and fire triggers through `ValidatedAnimator.SetTrigger`. Use it instead of `ReconciledAnimator` or `NetworkAnimator`, not beside them. |
| `ValidatedAnimatorRootMotion` | The base layer's playback. | It needs a `ReconciledAnimator` or a `ValidatedAnimator`. Use it when root motion decides where a character goes. It is the only one that declares no system of its own: list `ValidatedAnimatorRootMotionComponent` in the composition of the behaviour that sets the animator's parameters. It costs a full animator step for every replayed tick. |

- Add only one of `ValidatedTransform`, `ValidatedRigidbody` or `ValidatedCharacterController` to an object. The body and controller versions already keep the transform's values.
- Never put a validated behaviour on an object that also has a `NetworkRigidbody` or a `NetworkTransform`, because both would write the same body.

## Write the client state and push the body

1. Put the client state in a component of `MemberRole.Predict` members:

```csharp
using Nucleus.Components;

namespace MyGame
{
    public partial class SteerComponent : NetworkComponent
    {
        // -1 left, 0 straight, 1 right. Whole steps, so the server simulates exactly the steer the client did.
        public readonly NetworkMember<sbyte> Steer = new(role: MemberRole.Predict);
    }
}
```

2. Push the body from `OnEarlyFixedUpdate`. Physics steps after every early fixed update, live or replayed, and the `ValidatedRigidbody` captures the result on the late one:

```csharp
using Nucleus.Integrations.Unity.Systems;
using Nucleus.Managers.NetworkLoop;
using Nucleus.Systems;
using UnityEngine;
using UnityEngine.InputSystem;

namespace MyGame
{
    // The prefab also carries a NetworkSystemObject and a ValidatedRigidbody. This script declares only the client state.
    [RequireComponent(typeof(Rigidbody))]
    public class BallSteering : NucleusBehaviour<SteerComponent>
    {
        [SerializeField] private float _steerAcceleration = 20f;
        [SerializeField] private float _sidewaysGrip = 3f;

        private Rigidbody _rigidbody;
        private sbyte _intendedSteer;

        protected override void Awake()
        {
            _rigidbody = GetComponent<Rigidbody>();

            base.Awake();
        }

        protected override void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext)
        {
            // A client watching a ball it does not predict has nothing to simulate.
            if (simulationContext.Type is SimulationType.None)
                return;

            // The server's step for a tick whose client state never arrived: keep steering the way the client last asked.
            if (stepDelta.IsClientStateMissing)
                Component.TryGetLastState(isEveryMemberCarried: true);

            // Only the controller's live tick writes client state. A replayed tick reads the steer recorded for it.
            if (simulationContext.Type is SimulationType.Forward && IsController(ControllerType.AnyController))
                Component.Steer.Value = _intendedSteer;

            Vector3 velocity = _rigidbody.linearVelocity;
            float sidewaysAcceleration = Component.Steer.Value * _steerAcceleration - velocity.x * _sidewaysGrip;
            _rigidbody.AddForce(new Vector3(sidewaysAcceleration, 0f, 0f), ForceMode.Acceleration);
        }

        private void Update()
        {
            if (Component is null || !IsController(ControllerType.AnyController))
                return;

            // Replace with your project's input system.
            Keyboard keyboard = Keyboard.current;

            if (keyboard is null)
                return;

            _intendedSteer = (sbyte)((keyboard.dKey.isPressed ? 1 : 0) - (keyboard.aKey.isPressed ? 1 : 0));
        }
    }
}
```

3. Give the client control of the object, for example with `NetworkPlayerSpawner`.
4. Test with a dedicated server and a separate client. A host is the server, so its own ball is never corrected.

Follow the same rules as any predicted step:

- **Apply forces only in `OnEarlyFixedUpdate`.** Physics steps on the network tick, so a force applied in `FixedUpdate` runs at the wrong rate and is never replayed.
- **Read only members, the body and constants.** The step must compute the same thing on the client and the server for the same tick.
- **Play sounds and effects only on `SimulationType.Forward`.** A replay runs the step again for every tick since the one that went wrong.

## Hold every other body still during a replay

A replay needs the default **NucleusPerTick** execution mode (see [Physics execution modes](./physics-execution-modes.md)). Every dynamic body that is not being replayed must be held still during a replay:

- A validated body that is not being replayed holds itself.
- A `NetworkRigidbody` body adds a `ReplayHeldBody` by default. See [NetworkRigidbody](./network-rigidbody.md).
- Any other dynamic body a replay must not move needs a `ReplayHeldBody` of its own.

A held body is not rewound, so a predicted body that pushed it in the past can meet it in a different place.

## Set how often results are sent

Every validated behaviour has a **Send Interval** field. Set it before play; it is read when the behaviour links.

- **Normal** (default) sends every tick. It is the best choice for competitive games.
- **Short** sends less often, saving bandwidth and CPU at the cost of slightly more corrections.
- **Long** sends least often, for casual or large-scale games.

Short and Long only pace in Pro. A paced interval still sends on the tick the object's client state changes. If another script on the object has client state that never moves the body, such as a weapon's fire button, list it under **Ignored Behaviours** so its changes no longer send the body's results early.

## Let other clients predict the body too

Tick **Predicted By Observers** on the object's `NetworkSystemObject` and observing clients predict it as its controller does, the validated system included. Use it for bodies that players collide with or push, including a server-owned body nobody controls, such as a ball every player can hit. The simulation must call `TryGetLastState` when `stepDelta.IsClientStateMissing` is true, since an observer never has the controller's client state in time. See [Prediction settings on the Unity manager](../control/prediction-settings-in-unity.md).

## Draw the body through a GraphicalSmoother

The body moves once per tick, and a correction moves it again. Put the renderer on a child, add a `GraphicalSmoother` to the body and assign the child as its **Child Graphic**, so the drawn ball glides between ticks and across corrections while the body and its colliders stay exact. See [Smoothing a predicted object with GraphicalSmoother](../control/graphical-smoother.md).

## Expect a rare correction

The validated behaviours give their position, rotation and velocities a `resultTolerance`: a predicted value that close to the server's does not count as wrong. The server can only measure that distance while the controller's **Send Result Values** is on, which is the default; with it off, results are compared exactly and corrections are more frequent.

Watch `NetworkSystem.ReconcileCount` on the client and `Connection.ResultMismatchCount` on the server while you play with some latency. A correction now and then is normal. A count that climbs every tick means the client and the server step differently; see [Diagnosing desync](../diagnostics/diagnosing-desync.md).
