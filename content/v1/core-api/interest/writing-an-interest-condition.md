---
title: "Writing an interest condition"
---

An `IInterestCondition` decides one aspect of what a `Connection` receives for a `NetworkSystem`. For how conditions stack and when they run, see [What area of interest is](./area-of-interest.md).

```csharp
public interface IInterestCondition
{
    InterestEffect Capabilities { get; }

    InterestResult Evaluate(NetworkSystem networkSystem, Connection connection);
}
```

## Declare every effect the condition can return

`Capabilities` states every effect the condition can ever return an opinion on. An effect left out is never asked, so an opinion on an undeclared effect is silently ignored. Declare only the effects the condition speaks to, since each declared effect costs an evaluation per pair. `InterestEffect.None` is rejected at registration.

`InterestEffect` is a `[Flags]` enum:

- `Spawn`: while unmet, the system does not exist for the connection, and one already spawned is despawned.
- `Stop`: while unmet, the system stops for the connection but its object is kept. See [Stopping versus culling](./stopping-versus-culling.md).

A spawn-only condition declares `InterestEffect.Spawn`. One that speaks to both declares `InterestEffect.Spawn | InterestEffect.Stop`.

## Return an InterestResult

`Evaluate` returns an `InterestResult`, which can carry an opinion on each declared effect, so one measurement can veto both spawn and stop.

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

- `InterestResult.Spawn(isMet)`: a spawn-only verdict. An unmet one culls the system for the pair.
- `InterestResult.Stop(isMet)`: a stop-only verdict. An unmet one stops the system for the pair and keeps its object.
- `WithSpawn(isMet)` / `WithStop(isMet)`: set the other effect on a copy, for a condition that speaks to both.
- `InterestResult.None`: no opinion on any effect. Return this for a pair the condition cannot measure, rather than guessing a restriction.

Each effect carries an `InterestOpinion`:

```csharp
public enum InterestOpinion : byte
{
    None = 0,
    Unmet = 1,
    Met = 2,
}
```

Only `Unmet` restricts. `Met` and `None` resolve the same way. Any unmet `Spawn` opinion from any condition keeps the system away from the connection, and any unmet `Stop` opinion stops it, whatever the other conditions said.

## Keep Evaluate a pure read

`Evaluate` runs on the network loop thread, on the manager's evaluation cadence. It must not start or stop systems, change observers, or block.

## Start from one of these conditions

A condition that always approves spawn, the shape a non-distance rule (scene membership, team, bundle ownership) takes:

```csharp
private sealed class AlwaysMetInterestCondition : IInterestCondition
{
    public InterestEffect Capabilities => InterestEffect.Spawn;

    public InterestResult Evaluate(NetworkSystem networkSystem, Connection connection) => InterestResult.Spawn(isMet: true);
}
```

A condition driven by a caller-supplied policy:

```csharp
private sealed class PolicyInterestCondition : IInterestCondition
{
    public InterestEffect Capabilities { get; }
    private readonly Func<NetworkSystem, Connection, InterestResult> _evaluator;

    public PolicyInterestCondition(Func<NetworkSystem, Connection, InterestResult> evaluator, InterestEffect capabilities = InterestEffect.Spawn | InterestEffect.Stop)
    {
        _evaluator = evaluator;
        Capabilities = capabilities;
    }

    public InterestResult Evaluate(NetworkSystem networkSystem, Connection connection) => _evaluator(networkSystem, connection);
}

// Cull one connection from a system while every other connection keeps receiving it:
networkSystem.AddInterestCondition(new PolicyInterestCondition(
    (system, connection) => InterestResult.Spawn(connection != culledConnection)));
```

Register a condition on one system with `NetworkSystem.AddInterestCondition`, or globally with `InterestManager.AddCondition`. See [Registering interest conditions](./registering-interest-conditions.md).

## Unity conditions authored on a prefab derive from AuthoredInterestCondition

A condition authored on a prefab derives from `AuthoredInterestCondition`, a public abstract `[Serializable]` class, and builds the runtime `IInterestCondition` in its `CreateCondition` method. The add-rule menu finds subclasses automatically.
