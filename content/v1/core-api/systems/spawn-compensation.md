---
title: "Spawn compensation"
---

## The problem

An object spawned by the server does not exist on an observer until its spawn packet crosses the network and clears that peer's interpolation buffer. By the time the observer starts simulating it, the object is already a round trip behind where it should be. A projectile spawned moving is the clearest case: it appears at its origin point instead of somewhere along the path it has already travelled, and it stays visibly behind until something closes the gap.

Spawn compensation closes that gap by giving the object a burst of extra simulation time right after it starts, front-loaded so most of the catch-up happens in the opening ticks and the rest eases out smoothly. It is a Pro feature.

## Enabling it

Call `NetworkSystem.EnableSpawnCompensation` once the object has started, typically from whatever the game runs when the object comes into being:

```csharp
EnableSpawnCompensation(SpawnCompensationScope.All);
```

`aggression` controls how strongly the budget is front-loaded and defaults to `SpawnCompensationCurve.DefaultAggression` (2). Passing a value below `SpawnCompensationCurve.MinimumAggression` (1) clamps up to it; at 1 the budget is spent at a constant rate across the schedule instead of easing.

```csharp
EnableSpawnCompensation(SpawnCompensationScope.All, aggression: 3f);
```

Calling it a second time restarts the schedule rather than adding to it. `CancelSpawnCompensation` abandons a catch-up still owed time, leaving the object wherever the schedule had reached:

```csharp
CancelSpawnCompensation();
```

Each peer resolves its own budget from its own role and its own measured link, so the schedule itself never goes on the wire. The one figure that does is how much catch-up the server already spent, carried on the object's spawn so a remote client can add it to its own (see Bounds below). An object that never compensates sends no figure.

## Choosing a scope

`SpawnCompensationScope` is a flags enum that says which peers run the catch-up:

- `None` — nobody compensates; the object starts its life at the tick it was built on.
- `Authority` — the server catches the object up through the latency a client's spawn *request* spent reaching it. Only a client-predicted spawn has lost any time getting to the server; the server's own spawns are on time by definition and this scope compensates nothing for them.
- `RemoteClients` — every client other than the one that predicted the spawn catches the object up through its own downstream latency.
- `All`: both hops compensate. They stack: a remote client is owed what the server already spent plus its own delivery delay, and the two together are held to the one cap.

Whichever scope is declared, the peer that predicted the spawn never compensates: it has been simulating the object since the tick it spawned it, so it is already exactly as far ahead as the budget would carry it.

The choice is really about who simulates the object. An object the server simulates and replicates the pose of wants `Authority` alone — a receiving client that fast-forwarded it would be dragged straight back by the next delta from the server, so the catch-up would only show as a stutter. An object every peer simulates for itself from the parameters it spawned with, the ordinary projectile, wants `All` — no correction is coming to fight it, and the receiving client's own downstream latency is real time the object owes.

## Reading it while it runs

`IsSpawnCompensating` is true while a schedule is still owed time on the object. `SpawnCompensationSeconds` is the extra time the current tick is spending on the catch-up, in seconds, and reads zero when nothing is compensating — read it beside the tick's own delta when the game simulates on a step of its own rather than subscribing to the event.

The more direct hook is `SpawnCompensationStepped`, raised once per tick while the schedule is running, immediately before that tick's early fixed-update callbacks:

```csharp
SpawnCompensationStepped += OnSpawnCompensationStepped;

void OnSpawnCompensationStepped(in SpawnCompensationDelta delta)
{
    transform.position += velocity * delta.TotalDelta;
}
```

`SpawnCompensationDelta` carries the timing for that step: `FixedDelta` is the tick's ordinary fixed delta, `CompensationDelta` is the extra time this step is spending, and `TotalDelta` is the two added together — the figure to advance motion by so the handler needs no branch for whether a catch-up is running. `BudgetSeconds` and `RemainingSeconds` report the whole schedule and what is still owed after this step; `StepIndex` and `StepCount` (counting from one) report progress through it.

## Bounds

How much a peer can be asked to compensate is capped, in milliseconds:

- `NetworkSystem.DefaultMaximumSpawnCompensationMilliseconds` is 150, the default cap.
- `NetworkSystem.MaximumSpawnCompensationCeilingMilliseconds` is 500, the highest the live setting can be raised to.
- `SystemManager.MaximumSpawnCompensationMilliseconds` is the live setting; its setter clamps to the ceiling above.

```csharp
CoreManager.SystemManager.MaximumSpawnCompensationMilliseconds = 300;
```

The cap bounds the whole of one peer's catch-up, counted across every hop the object travelled. Under `SpawnCompensationScope.All`, a remote client adds what the server already spent to its own delay and holds the sum to the cap, so an object that crossed two links is displaced no further than one that crossed a single slow link. Because a schedule is never longer than its budget, the cap also bounds how long a catch-up runs.

`NetworkSystem.MaximumTransmittedSpawnCompensationTicks` is 63 — the most ticks of already-spent server-side compensation the wire can carry when it tells a remote client how much of the object's age the server already accounted for. A budget larger than that is clamped to 63 ticks for transmission, independent of the millisecond cap.

`aggression` shapes the curve rather than the budget: it never changes how much time is owed, only how quickly the schedule spends it.

## What it isn't

Spawn compensation does not rewind the world. It only advances a newly spawned object's own simulation faster for a short window after it starts; nothing else on the peer is touched, and no other object's state is altered or replayed. It is also not lag compensation — rewinding the world to check a hit against where other players actually were at the time the shooter fired. Nucleus does not have lag compensation; spawn compensation solves a narrower problem, getting one object's starting position right.
