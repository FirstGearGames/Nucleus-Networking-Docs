---
title: "Supplying positions to the interest system"
---

> **Using Unity?** The Unity integration registers a position reader for you. See [Limit what a client receives by distance](../../unity/interest/limit-replication-by-distance.md) to configure the distance conditions.

The [replay hold radius](../control/reconciliation.md#holding-only-the-systems-near-a-replay) (`SystemManager.ReplayHoldRadius`) reads object positions through a position reader registered on the `InterestManager`. Core has no way to know where an object is, so a bare `CoreManager` registers none, and a replay then holds every system it cannot measure. Scene-based interest and distance conditions do not use this reader. A distance condition reads positions through its own `TryReadSourcePosition` (see [Distance interest conditions](./distance-interest-conditions.md)).

## Implement IInterestPositionReader

```csharp
public interface IInterestPositionReader
{
    bool TryReadPosition(NetworkSystem networkSystem, out Vector3 position);
}
```

- `Vector3` is `System.Numerics.Vector3`. If your engine uses a different vector type, convert it in the reader.
- Return `false` for a system whose object has been destroyed or has not finished spawning. Never return a stale or default position.
- Write the raw read only. The manager reads each system once per interest pass and caches the result, failed reads included, so your reader needs no caching of its own.

A dictionary-backed reader suits a host with no scene graph to query:

```csharp
public sealed class DictionaryInterestPositionReader : IInterestPositionReader
{
    private readonly Dictionary<NetworkSystem, Vector3> _positions = new();

    public void SetPosition(NetworkSystem networkSystem, Vector3 position) => _positions[networkSystem] = position;

    public bool TryReadPosition(NetworkSystem networkSystem, out Vector3 position) => _positions.TryGetValue(networkSystem, out position);
}
```

A system with no recorded position reads as unmeasurable, not as position zero.

## Register the reader on the interest manager

```csharp
public void SetPositionReader(IInterestPositionReader interestPositionReader);
```

Call `InterestManager.SetPositionReader` once during setup. Pass `null` to clear it when your integration shuts down.
