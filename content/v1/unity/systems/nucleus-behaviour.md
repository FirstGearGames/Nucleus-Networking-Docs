---
title: "NucleusBehaviour: the script base class"
components: "NucleusBehaviour"
---

> **Driving the core API directly?** See [Renting and finding systems in code](../../core-api/systems/renting-and-watching-systems.md).

Inherit `NucleusBehaviour<TComponent0>` for a gameplay script that belongs to one networked system. It requires a `NetworkSystem` carrying `TComponent0` for you and exposes that component as `Component` once the system links.

## Pick the base class

| Base class | Use it when |
|---|---|
| `NucleusBehaviour<TComponent0>` | The script needs one component on a plain `NetworkSystem`. |
| `NucleusBehaviour<TSystem, TComponent0, ...>` | The script needs a system type other than `NetworkSystem`, or more than one component. Overloads go up to 31 component types (`TComponent0` through `TComponent30`). |
| `NucleusBehaviour` (non-generic) | The script needs only the role and control checks and the hooks, and another component on the object, such as a `NetworkTransform` or `NetworkRigidbody`, already declares the system. |

`NucleusBehaviourBase` holds the shared members below; scripts do not inherit it directly.

The non-generic `NucleusBehaviour` declares nothing and adopts whichever system the object's `NetworkSystemObject` links. If nothing else on the object declares a system, it waits for the object's whole life. If the system it adopted stops while the object keeps another, it adopts the remaining one at the end of that frame; a whole-object despawn unlinks it and adopts nothing.

If a script needs a system it did not declare, rent or find it through the core API rather than adding a type parameter you don't otherwise need.

## Read the linked system

| Property | Type | Meaning |
|---|---|---|
| `NetworkSystem` | `NetworkSystem` | The linked system, or null before linking and after unlinking. |
| `CoreManager` | `CoreManager` | The bound manager, or null when none was bound. |
| `IsHostStarted` | `bool` | True when this peer runs both server and client, for a linked system. |
| `Component` | `TComponent0` | The required component, or null before `OnSystemLinked` and after `OnSystemUnlinked`. |

## Check role and control

- `IsController(ControllerType controllerType)` returns `NetworkSystem.IsController(controllerType)`, or false while no system is linked.
- `IsStarted(Invoker invoker)` returns whether this peer's server or client role is started, for a linked system.

`EnsureIsController(ControllerType controllerType)` and `EnsureIsStarted(Invoker invoker)` return the same answers, and log a warning naming the calling member when the answer is false. Each warns once per calling member and argument.

Use the `Ensure` form only where reaching the code without that role or control is a programming error, such as a server-only method that only server code calls. Use the plain form for checks that are expected to fail on some peers, such as input handling, RPC sends and per-tick callbacks:

```csharp
protected override void OnEarlySerialize(StepDelta stepDelta)
{
    if (!IsController(ControllerType.AnyController))
        return;

    // Safe to set controlled members here.
}
```

## Override the lifecycle hooks

Override these `protected virtual` methods:

| Hook | Called |
|---|---|
| `OnSystemLinked()` | Once `NetworkSystem` is linked. |
| `OnSystemUnlinked()` | As `NetworkSystem` unlinks, including when the behaviour is destroyed while linked. The system is still readable during the call. Reset a pooled instance's per-life state here. |
| `OnServerStarted()` | Once this peer's server role starts, with a system linked. |
| `OnServerStopped()` | Once this peer's server role stops while a system is linked. |
| `OnClientStarted()` | Once this peer's client role starts, with a system linked. |
| `OnClientStopped()` | Once this peer's client role stops while a system is linked. |
| `OnControllerChanged(Connection previousControllerConnection, Connection currentControllerConnection)` | On every peer when control of the linked system moves. |

When a system links while a role is already running, `OnServerStarted` or `OnClientStarted` is raised at once, so a script never misses a role that started before it linked.

## Call the base Awake, OnEnable, OnDisable and OnDestroy

The base class needs its own `Awake`, `OnEnable`, `OnDisable` and `OnDestroy`. If your script needs one of them, override it and call the base method:

```csharp
protected override void Awake()
{
    base.Awake();

    _renderer = GetComponent<Renderer>();
}
```

Call the base method first, unless `OnSystemLinked` reads something you set up: `base.Awake()` can link a system that already exists and raise `OnSystemLinked` on the spot, so cache what that hook reads before the call. Setup that needs the system belongs in `OnSystemLinked`.

The build reports both mistakes as errors, since either would leave the behaviour unlinked with nothing logged:

| Id | Reported when |
|---|---|
| `NUCLEUS001` | A class deriving, directly or indirectly, from `NucleusBehaviourBase` declares `Awake`, `OnEnable`, `OnDisable` or `OnDestroy` without `override`. |
| `NUCLEUS002` | An override of one of those four methods never calls the base method. |

The lifecycle hooks and per-step methods are empty in the base class, so their overrides may skip the base call.

## Run code on a loop step

Override any of these `protected virtual void On...(StepDelta stepDelta)` methods, listed in loop order:

```
OnEarlyVariableUpdate
OnEarlyStateUpdate
OnLateStateUpdate
OnReconcile
OnEarlyFixedUpdate
OnLateFixedUpdate
OnVariableUpdate
OnEarlySerialize
OnLateSerialize
OnTickAdvance
OnLateVariableUpdate
```

- `OnEarlyVariableUpdate`, `OnVariableUpdate` and `OnLateVariableUpdate` run every frame.
- `OnEarlyStateUpdate`, `OnLateStateUpdate`, `OnReconcile`, `OnEarlySerialize`, `OnLateSerialize` and `OnTickAdvance` run once per tick, on the frame that ticks.
- `OnEarlyFixedUpdate` and `OnLateFixedUpdate` run once per elapsed tick interval, so they can run twice in one frame after a long frame. They also take a `SimulationContext` naming the pass, and on a client that predicts the object they run again for every tick a reconcile replays (see [Replaying a correction in Unity](../control/reconcile-in-unity.md)).

See [The network loop steps](../core/network-loop-steps.md) for what each step means.

To move an object every frame, override `OnVariableUpdate` and move it by `stepDelta.NormalizedDelta` rather than moving it in `Update` by `Time.deltaTime`. The normalized delta keeps the distance moved each tick even, which costs far less to replicate. See [Tick rate and the loop in Unity](../core/unity-tick-rate-and-the-loop.md).

## Delay the start with CanStartSystem

`protected virtual bool CanStartSystem => true` decides whether the server may start the required system as soon as it is rented. Override it to return false for an object that must set its opening values before the spawn is announced, then start the system yourself. It is read once, when the system is declared, and ignored on a receiving client.
