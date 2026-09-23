---
title: "NucleusBehaviour: the script base class"
---

> **Driving the core API directly?** See [Renting and finding systems in code](../../core-api/systems/renting-and-watching-systems.md).

## What it does

`NucleusBehaviour<TComponent0>` is the base class for a gameplay `MonoBehaviour` that belongs to one networked system. On `Awake` it requires that system for you, resolving the `CoreManager` and calling `NetworkSystemObjectPool.RequireSystem`, and hands back a typed `Component` property once the system is acquired. A script inheriting it never writes the manager lookup, the `RequireSystem` call, or the unlink/unsubscribe that a hand-rolled version would otherwise repeat.

The class splits in two:

- `NucleusBehaviourBase` is the non-generic half: the `NetworkSystem` reference, role and control checks, the loud guards, and the twelve per-step virtuals. It never declares a required system, so it is not the type a script inherits directly.
- `NucleusBehaviour<TComponent0>` requires a `NetworkSystem` carrying `TComponent0` and exposes it as `Component`.

A generated family widens this to more component types: `NucleusBehaviour<TSystem, TComponent0>` through `NucleusBehaviour<TSystem, TComponent0, TComponent1, ..., TComponent31>`, one overload per arity from 1 to 32 component types, each naming the system type explicitly and each calling the matching `NetworkSystemObjectPool.RequireSystem<TSystem, TComponent0, ...>` overload. Use the generated form when a script needs a system that isn't just `NetworkSystem`, or needs more than one component off it.

## Inherited properties

| Property | Type | Meaning |
|---|---|---|
| `NetworkSystem` | `NetworkSystem` | The linked system, or null before linking and after unlinking. |
| `CoreManager` | `CoreManager` | The manager resolved in `Awake`, or null when none was bound. |
| `IsHostStarted` | `bool` | True when this peer runs both server and client roles at once, for a linked system. |
| `Component` | `TComponent0` | The typed component this behaviour required, or null before `OnSystemLinked` and after `OnSystemUnlinked`. |

## Role and control checks

- `IsController(ControllerType controllerType)` returns `NetworkSystem.IsController(controllerType)`, or false while no system is linked.
- `IsStarted(Invoker invoker)` returns whether this peer's server or client role is started, for a linked system; false until one links.

Both have loud counterparts that log instead of failing silently:

- `EnsureIsController(ControllerType controllerType, [CallerMemberName] string callerMemberName = null)`
- `EnsureIsStarted(Invoker invoker, [CallerMemberName] string callerMemberName = null)`

Each returns the same answer as its plain counterpart, and when that answer is false, logs a warning naming the calling member (supplied automatically via `[CallerMemberName]`) - on every failing call, not throttled. Reach for the loud form where a failure means a real bug worth surfacing loudly: a one-off action like handling a button press or an RPC, not a per-tick callback. A per-tick write like `OnEarlyStateWrite` runs every tick on every peer, so a non-controlling peer failing the check is the normal, expected case, not a bug - use the plain form there so it doesn't spam the log every tick:

```csharp
protected override void OnEarlyStateWrite(StepDelta stepDelta)
{
    if (!IsController(ControllerType.AnyController))
        return;

    // Safe to write controlled state here.
}
```

## Lifecycle hooks

Override these `protected virtual` methods on `NucleusBehaviourBase`:

| Hook | Guarantee |
|---|---|
| `OnSystemLinked()` | Called once `NetworkSystem` is linked. |
| `OnSystemUnlinked()` | Called as `NetworkSystem` unlinks, while it is still readable for the duration of the call. A pooled, recycled instance resets its per-life state here. |
| `OnServerStarted()` | Called once this peer's server role starts, with a system already linked. |
| `OnServerStopped()` | Called once this peer's server role stops while a system is still linked. |
| `OnClientStarted()` | The client-role counterpart of `OnServerStarted`. |
| `OnClientStopped()` | The client-role counterpart of `OnServerStopped`. |
| `OnControllerChanged(Connection previousControllerConnection, Connection currentControllerConnection)` | Called on every peer when control of the linked system moves. |

Linking adopts whichever roles are already started rather than waiting for an edge: `LinkSystem` reseeds its tracked server/client flags from the live state and immediately raises `OnServerStarted`/`OnClientStarted` for any role already up, instead of only firing on a later start/stop transition. A scene object's `Awake` runs on every peer regardless of which of them already has a role running, so a script that only reacted to edges would miss a role that started before it linked.

## Per-step virtuals

Twelve `protected virtual void On...(StepDelta stepDelta)` methods, one per tick-loop step, in loop order:

```
OnEarlyVariableUpdate
OnEarlyTickUpdate
OnEarlyStateUpdate
OnLateStateUpdate
OnReconcile
OnEarlyFixedUpdate
OnLateFixedUpdate
OnVariableUpdate
OnEarlyStateWrite
OnLateStateWrite
OnLateTickUpdate
OnLateVariableUpdate
```

`Awake` reflects over these once to find which ones this instance's concrete type overrides, and only those steps are ever dispatched to. Registration for the loop steps a type overrides is taken and dropped alongside `OnEnable`/`OnDisable` (and tied to whether a system is linked), so a disabled or pooled-and-despawned behaviour costs nothing per tick.

See the tick-loop pages for what each step means and when it runs.

## CanStartSystem

`protected virtual bool CanStartSystem => true` controls whether the server may start the required system as soon as it is rented. It's read once, when the required system is declared, so a later change to it has no effect, and it's ignored on a receiving client, which is handed a system that already started elsewhere. Override it to return false for an object that must write its opening state before the spawn is announced, then start the system itself.

## A script that needs an undeclared system

`NucleusBehaviour<TComponent0>` (and its generated overloads) only give you the system(s) named in the type parameters. If a script needs a different system it didn't declare, rent or find it separately through the core API rather than adding it to the type parameter list for a type you don't otherwise need.
