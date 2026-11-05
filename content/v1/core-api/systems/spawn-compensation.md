---
title: "Spawn compensation"
---

An object the server spawns reaches an observer a round trip late, after the spawn crosses the network and waits out that peer's interpolation. A projectile spawned moving appears at its origin instead of along the path it has already travelled. Spawn compensation closes the gap by giving the object extra simulation time right after it starts, most of it in the opening ticks. It is a Pro feature.

It only advances the new object's own simulation for a short window. It does not rewind the world or touch any other object, and it is not [lag compensation](../lag-compensation/how-lag-compensation-works.md), which judges a shot against where targets were.

## Enable compensation once the object has started

Call `NetworkSystem.EnableSpawnCompensation` once the object has started:

```csharp
EnableSpawnCompensation(SpawnCompensationScope.All);
```

`aggression` sets how strongly the time is front-loaded. It defaults to `SpawnCompensationCurve.DefaultAggression` (2); a value below `SpawnCompensationCurve.MinimumAggression` (1) clamps to 1, which spends the time at a constant rate. It changes how quickly the time is spent, never how much.

```csharp
EnableSpawnCompensation(SpawnCompensationScope.All, aggression: 3f);
```

Calling it again restarts the schedule rather than adding to it. `CancelSpawnCompensation` abandons the rest of a catch-up, leaving the object where the schedule had reached:

```csharp
CancelSpawnCompensation();
```

Each peer works out its own budget from its role and its measured link.

## Choose a scope by who simulates the object

`SpawnCompensationScope` is a flags enum naming which peers catch up:

- `None`: nobody compensates.
- `Authority`: the server catches up through the time a client's predicted spawn request spent reaching it. The server's own spawns are never late, so this does nothing for them.
- `RemoteClients`: every client other than the one that predicted the spawn catches up through its own downstream latency.
- `All`: both. A remote client is owed what the server already spent plus its own delay, held to one cap.

The client that predicted the spawn never compensates, whatever the scope.

- An object the server simulates and replicates the pose of wants `Authority` alone. A client that fast-forwarded it would be pulled back by the next server update, which shows as a stutter.
- An object every peer simulates from its spawn parameters, such as an ordinary projectile, wants `All`.

## Advance motion by the catch-up time

`IsSpawnCompensating` is true while a schedule still owes time. `SpawnCompensationSeconds` is the extra time this tick spends on the catch-up, or zero when nothing is compensating; read it beside the tick delta if the game simulates on its own step.

Or subscribe to `SpawnCompensationStepped`, raised once per tick while the schedule runs, before that tick's early fixed-update callbacks:

```csharp
SpawnCompensationStepped += OnSpawnCompensationStepped;

void OnSpawnCompensationStepped(in SpawnCompensationDelta delta)
{
    transform.position += velocity * delta.TotalDelta;
}
```

`SpawnCompensationDelta` carries:

| Field | Meaning |
|---|---|
| `FixedDelta` | The tick's ordinary fixed delta. |
| `CompensationDelta` | The extra time this step spends. |
| `TotalDelta` | Both added together. Advance motion by this so the handler needs no branch. |
| `BudgetSeconds` | The whole schedule. |
| `RemainingSeconds` | What is still owed after this step. |
| `StepIndex`, `StepCount` | Progress through the schedule, counting from one. |

## Cap how much time a peer makes up

The cap bounds one peer's whole catch-up across every hop, and so also how long it runs. In Unity it is **Max Spawn Compensation (ms)** on the Unity Lag Compensation Manager.

| Member | Value |
|---|---|
| `LagCompensationManager.DefaultMaximumSpawnCompensationMilliseconds` | 150, the default cap. |
| `LagCompensationManager.MaximumSpawnCompensationCeilingMilliseconds` | 500, the highest the cap can be set. |
| `LagCompensationManager.MaximumSpawnCompensationMilliseconds` | The live cap. Its setter clamps to the ceiling. |
| `NetworkSystem.MaximumTransmittedSpawnCompensationTicks` | 63, the most ticks of server-side compensation a remote client is told about. Larger amounts clamp to 63, independent of the millisecond cap. |

```csharp
CoreManager.LagCompensationManager.MaximumSpawnCompensationMilliseconds = 300;
```
