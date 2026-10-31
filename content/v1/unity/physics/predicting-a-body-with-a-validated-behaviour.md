---
title: "Predicting a body with a validated behaviour"
---

> **Driving the core API directly?** See [Predicted members and prediction history](../../core-api/control/prediction-history-and-predicted-members.md) and [Reconciliation and replay](../../core-api/control/reconciliation.md).

A validated behaviour lets the client that controls an object predict a Unity `Rigidbody`, transform or `CharacterController` from its own client state, while the server runs the same client state and checks the result. When the two disagree, the client is corrected and replays every tick since, physics included. You add the behaviour to the object and write only the client state and the forces yourself.

The `BallRacer` demo under `Demos/Tutorials` is the worked example on this page: a ball a client steers left and right, with a local cheat key the server catches.

## A validated behaviour keeps one Unity component in predicted members.

Each validated behaviour keeps the state of one Unity component in `MemberRole.Validate` members and declares a predicted system of its own for them. Your own script does not list it in its composition. Every tick, after physics has stepped, the behaviour reads the component's state into its members, rounds it to their accuracy and writes the rounded values back, so the client and the server carry on from the same numbers.

The behaviours live in the `Nucleus.Integrations.Unity.Prediction` namespace:

| Behaviour | What it keeps | Notes |
| --- | --- | --- |
| `ValidatedTransform` | Position, rotation, scale, active state and layer. | **Transform Space** is World (the default) or Local; Local suits an object carried by a parent that is replicated itself. **Active State Apply Enabled** (off by default) applies the active state to the GameObject. |
| `ValidatedRigidbody` | Everything `ValidatedTransform` keeps, plus the velocities and whether the body is asleep. | Add `ValidatedRigidbodyAdvanced` beside it to also keep kinematic, collision detection, constraints and center of mass. |
| `ValidatedRigidbody2D` | The same for a `Rigidbody2D`. | `ValidatedRigidbody2DAdvanced` is the 2D version of the advanced settings. |
| `ValidatedCharacterController` | Everything `ValidatedTransform` keeps, plus whether the controller is enabled. | Add `ValidatedCharacterControllerAdvanced` for height, center and radius. A replay does not restore the controller's velocity, grounded flag or collision flags, so keep your own velocity and grounded state as members. |
| `ValidatedConstantForce`, `ValidatedConstantForce2D` | The force, relative force, torque and relative torque of a `ConstantForce`. | Add it beside the pushed body's `ValidatedRigidbody` or `ValidatedRigidbody2D`. |
| `ReconciledAnimator` | Every animator parameter and layer weight, on this peer only. | It is a `NetworkAnimator` that also puts back the parameters of the restored tick before a replay, so a mispredicted trigger or bool does not stick. Use it instead of `NetworkAnimator` on a predicted object. A client-authoritative object keeps the plain `NetworkAnimator`. |
| `ValidatedAnimatorRootMotion` | The base layer's playback. | It needs a `ReconciledAnimator`. Use it when root motion decides where a character goes. It is the only one that declares no system of its own: list `ValidatedAnimatorRootMotionComponent` in the composition of the behaviour that sets the animator's parameters. It costs a full animator step for every replayed tick. |

Add only one of `ValidatedTransform`, `ValidatedRigidbody` or `ValidatedCharacterController` to an object. The body and controller versions already keep the transform's values. Never put a validated behaviour on an object that also has a `NetworkRigidbody` or a `NetworkTransform`, because both would write the same body.

## A replay steps the whole physics world once for each replayed tick.

When a correction arrives, the client puts every system it predicts back to the server's values at the tick that went wrong, then simulates every tick since then again. On each replayed tick the integration steps physics between the early and late fixed updates, just as it does on a live tick, for 3D and 2D physics alike. This needs the default **NucleusPerTick** execution mode (see [Physics execution modes](./physics-execution-modes.md)).

Stepping the world moves every dynamic body in it, so a body that is not being replayed needs to be held still:

- A validated body whose system the replay leaves out holds itself. The behaviour makes the body kinematic for the replay and gives back its velocities and sleep state afterwards, so it needs nothing extra.
- A `NetworkRigidbody` body is never replayed. It adds a `ReplayHeldBody` by default, which holds it in the same way. See [NetworkRigidbody](./network-rigidbody.md).
- Any other dynamic body a replay must not move needs a `ReplayHeldBody` of its own.

A held body keeps its colliders. During the replay it stands where it is now, not where it was on the replayed tick, so a predicted body that pushed it in the past meets something that does not give.

## Choose a validated behaviour when the client controls the body.

Nucleus has two ways to make a body respond at once to the player driving it:

- **A validated behaviour** suits a body the client controls outright, such as a player's own ball or vehicle. The client simulates it from its own client state, the server repeats the step and checks the result, and a wrong result is replayed. It resists cheating with no extra code, because the server never takes the client's result. Each correction costs a replay of the physics world, and physics is not exactly the same on every machine, so a rare correction is normal.
- **`NetworkRigidbody` with `Convergence.IsLocallyPredicted`** suits a body the server controls and simulates while one client steers it. The client never replays; its body is eased toward the server's state over a few ticks. It needs a target provider that includes your client state. See [Driving a predicted body](./driving-a-predicted-body.md).

Choose a validated behaviour for competitive play where the player's own body must match the server's. Choose convergence when you would rather never pay for a replay and a softer correction is fine.

## Your script writes the client state and pushes the body.

Put the client state in a component of `MemberRole.Predict` members:

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

Then push the body from `OnEarlyFixedUpdate`. Physics steps after every early fixed update, live or replayed, and the `ValidatedRigidbody` captures the result on the late one:

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

Follow the same rules as any predicted step:

- **Apply forces only in `OnEarlyFixedUpdate`.** Under Nucleus, physics steps on the network tick, so a force applied in `FixedUpdate` runs at the wrong rate and is never replayed.
- **Read only members, the body and constants.** The step must compute the same thing on the client and the server for the same tick.
- **Play sounds and effects only on `SimulationType.Forward`.** A replay runs the step again for every tick since the one that went wrong.

Give the client control of the object, for example with `NetworkPlayerSpawner`, and test with a dedicated server and a separate client. A host is the server, so its own ball is never corrected.

## Send Interval sets how often the results are sent.

Every validated behaviour has a **Send Interval** field:

- **Normal** sends every tick. It is the default and the best choice for competitive games.
- **Short** sends less often, saving bandwidth and CPU at the cost of slightly more corrections.
- **Long** sends least often, for casual or large-scale games.

A paced interval still sends on the tick the object's client state changes, because the behaviour follows every other system on the object. Short and Long only pace in Pro. The field is read when the behaviour links, so set it before play.

## Ignored Behaviours lists scripts that never move the body.

When another script on the object has client state that does not move the body, such as a weapon's fire button, list it under **Ignored Behaviours**. Its client state changes then no longer send the body's results early. This only matters at a Short or Long interval.

## Predicted By Observers lets other clients predict the body too.

Tick **Predicted By Observers** on the object's `NetworkSystemObject` and observing clients predict it as its controller does, the validated system included. This matters for bodies that players collide with or push. It also works for a server-owned body nobody controls, such as a ball every player can hit. The simulation must call `TryGetLastState` when `stepDelta.IsClientStateMissing` is true, since an observer never has the controller's client state in time. See [Prediction settings on the Unity manager](../control/prediction-settings-in-unity.md).

## Draw the body through a GraphicalSmoother.

The body moves once per tick, and a correction moves it again. Put the renderer on a child, add a `GraphicalSmoother` to the body and assign the child as its **Child Graphic**, so the drawn ball glides between ticks and across corrections while the body and its colliders stay exact. See [Smoothing a predicted object with GraphicalSmoother](../control/graphical-smoother.md).

## A rare correction is healthy.

Physics is not exactly the same on every machine, so the validated behaviours give their position, rotation and velocities a `resultTolerance`: a predicted value that close to the server's does not count as wrong. The server can only measure that distance while the controller's **Send Result Values** is on, which is the default; with it off, the results are compared exactly and corrections are more frequent.

Watch `NetworkSystem.ReconcileCount` on the client and `Connection.ResultMismatchCount` on the server while you play with some latency. A correction now and then is normal. A count that climbs every tick means the client and the server step differently; see [Diagnosing desync](../diagnostics/diagnosing-desync.md).
