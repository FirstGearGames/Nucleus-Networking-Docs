---
title: "Writing an interest condition"
---

## What a condition does

An `IInterestCondition` decides one aspect of what a `Connection` receives for a `NetworkSystem`, so replication cost scales with what each client can actually perceive rather than with the size of the world. A condition registers globally on the `InterestManager`, covering every system spawned from then on, or on a single `NetworkSystem` through `AddInterestCondition`. Conditions stack: each is evaluated once per (system, Connection) pair on the manager's evaluation cadence, and the pair's resolution folds every stacked opinion, most-restrictive-wins per effect. With no condition registered, replication behaves exactly as it did before interest existed: every started system, to every authenticated client, every tick.

The interface has exactly two members.

```csharp
public interface IInterestCondition
{
    InterestEffect Capabilities { get; }

    InterestResult Evaluate(NetworkSystem networkSystem, Connection connection);
}
```

## Capabilities: a promise, not a filter

`Capabilities` is declared once and states every effect this condition can ever return an opinion on. This is a promise, not a filter: an effect left out is never asked, so a condition that returns an opinion it did not declare has that opinion silently ignored. Declare every effect the implementation can ever return, and only those — declaring one the condition never speaks to costs an evaluation per pair for nothing. `InterestEffect.None` declares a condition that speaks to nothing, and is rejected at registration.

`InterestEffect` is a `[Flags]` enum with two members:

- `Spawn` — controls whether the system exists at all for the connection. While unmet, the system does not spawn there, and one already spawned despawns; the object is released on the receiver exactly as an ordinary despawn releases it.
- `Stop` — controls whether the system stays started for the connection. While unmet, the system stops for the connection but its engine object is retained, so a distant object can stay visible while it stops costing replication; the object is reclaimed only when a `Spawn` condition culls it too.

A condition that only ever has an opinion about spawning declares `InterestEffect.Spawn`; one that speaks to both declares `InterestEffect.Spawn | InterestEffect.Stop`.

## Building a verdict

`Evaluate` returns an `InterestResult`, an independent opinion on any subset of the effects the condition declares, so one condition can veto spawn and stop from a single measurement.

```csharp
public readonly struct InterestResult
{
    public readonly InterestOpinion SpawnOpinion;
    public readonly InterestOpinion StopOpinion;

    public static InterestResult None => default;

    public InterestResult WithSpawn(bool isMet);
    public InterestResult WithStop(bool isMet);

    public static InterestResult Spawn(bool isMet);
    public static InterestResult Stop(bool isMet);
}
```

- `InterestResult.Spawn(isMet)` — a spawn-only verdict; an unmet one alone culls the system for the pair.
- `InterestResult.Stop(isMet)` — a stop-only verdict; an unmet one stops the system for the pair while keeping its engine object.
- `WithSpawn(isMet)` / `WithStop(isMet)` — combinators that set the other axis on a copy, for a condition that speaks to both effects in one evaluation.
- `InterestResult.None` — a verdict abstaining on every effect, imposing no restriction and fighting no other condition. Return this for a pair the condition cannot measure, rather than guessing a false restriction.

## InterestOpinion: the tri-state

Each axis of an `InterestResult` carries an `InterestOpinion`:

```csharp
public enum InterestOpinion : byte
{
    None = 0,
    Unmet = 1,
    Met = 2,
}
```

`None` is the fold identity: the resolver ANDs every stacked opinion, so an abstaining condition never restricts. Only `Unmet` restricts; `Met` and `None` are indistinguishable to the fold and differ only in what the condition means to say. Stacked conditions fold most-restrictive-wins per effect — any unmet `Spawn` opinion from any condition keeps the system away from the connection, and any unmet `Stop` opinion stops it there, regardless of what the others said.

## The purity contract

`Evaluate` runs on the network loop thread, inside the serialization pass, on the manager's evaluation cadence rather than every tick. It must be a pure read: it must not start or stop systems, mutate observers, or block.

## A condition can only ever restrict

None of this can grant a connection more than the broadcast-to-everyone default. A condition narrows what a connection receives; there is no opinion that adds a connection beyond what it would already get with no conditions registered at all.

## A worked condition

From the test suite, a condition that always approves spawn — the shape a non-distance rule (scene membership, team, bundle ownership) takes:

```csharp
private sealed class TestAlwaysMetInterestCondition : IInterestCondition
{
    public InterestEffect Capabilities => InterestEffect.Spawn;

    public InterestResult Evaluate(NetworkSystem networkSystem, Connection connection) => InterestResult.Spawn(isMet: true);
}
```

And a condition driven by an external rule, evaluated per pair against a caller-supplied policy:

```csharp
private sealed class ProbeInterestCondition : IInterestCondition
{
    public InterestEffect Capabilities { get; }
    private readonly Func<NetworkSystem, Connection, InterestResult> _evaluator;

    public ProbeInterestCondition(Func<NetworkSystem, Connection, InterestResult> evaluator, InterestEffect capabilities = InterestEffect.Spawn | InterestEffect.Stop)
    {
        _evaluator = evaluator;
        Capabilities = capabilities;
    }

    public InterestResult Evaluate(NetworkSystem networkSystem, Connection connection) => _evaluator(networkSystem, connection);
}

// Cull one connection from a system while every other connection keeps receiving it:
networkSystem.AddInterestCondition(new ProbeInterestCondition(
    (system, connection) => InterestResult.Spawn(connection != culledConnection)));
```

Register the condition on a single system with `NetworkSystem.AddInterestCondition`, or globally with `InterestManager.AddCondition` to cover every system spawned from then on.

## Unity

A condition authored on a prefab derives from `AuthoredInterestCondition`, a public abstract `[Serializable]` class, and builds the runtime `IInterestCondition` from its `CreateCondition` method. Subclasses are discovered automatically by the add-rule menu; nothing has to be registered by hand.
