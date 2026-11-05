---
title: "Reading serialization history (and the raw-packet test hook)"
---

When a client has the wrong value and the log does not explain why, ask two separate questions: what did the server decide to serialize, and, far more rarely, what actually left the socket. Different tools answer each.

## Ask the server what it serialized

`SystemManager` keeps a rolling history of which `NetworkSystem` ids it serialized as changed or spawned on each tick, covering the last `SystemManager.SerializationHistoryTickCount` ticks. Anything older is gone.

- `IsSystemRecentlySerialized(uint systemId)`: whether this system was serialized within the window.
- `GetRecentlySerializedSystemIds(HashSet<uint> collectedSystemIds)`: every system id serialized within the window.
- `TryGetSerializedSystemIds(uint tick, HashSet<uint> collectedSystemIds)`: every system id serialized on one tick. Returns `false` if that tick has left the window.
- `TryGetSerializedSystemIdsAfterTick(uint afterTick, HashSet<uint> collectedSystemIds)`: every system id serialized on any tick after a baseline. Returns `false` if part of that range has left the window, so the results are incomplete rather than empty.

```csharp
HashSet<uint> changedSystemIds = HashSetPool<uint>.Rent();

bool isComplete = coreManager.SystemManager.TryGetSerializedSystemIdsAfterTick(lastKnownGoodTick, changedSystemIds);

foreach (uint systemId in changedSystemIds)
{
    if (coreManager.SystemManager.TryGetSystemReference(systemId, out NetworkSystem networkSystem))
        LoggingService.LogInformation($"Serialized: {networkSystem.AsString()}");
}

HashSetPool<uint>.Return(changedSystemIds);
```

If `isComplete` is `false`, treat the collected ids as a lower bound.

## Turn ids into readable names

A bare system or connection id in a log line does not say which object or peer it was, or whether it was valid. Use these in every log line that names one:

- `ConnectionExtensions.AsString(this Connection connection)`: describes a `Connection`, or returns `"IsNull"` if it is null.
- `NetworkSystemExtensions.AsString(this NetworkSystem networkSystem)`: describes a `NetworkSystem`, or returns `"IsNull"` if it is null.

`TryGetSystemReference` turns a bare id back into its `NetworkSystem`.

The sender of a packet is the `Connection` the read path hands you, never an id read out of the payload. If the two disagree, the payload value is the anomaly to investigate.

## Send a raw packet to test a transport

`TransportManager.RawPacketReceived` (`RawPacketReceivedHandler(Connection sendingConnection, Reader reader)`) fires only for `PacketType.Raw`, which exists only in a `DEBUG` build. The engine never sends one, so this is not a tap on gameplay traffic. To see what a transport delivers, send a raw packet yourself and subscribe to this event.

```csharp
coreManager.TransportManager.RawPacketReceived += (sendingConnection, reader) =>
{
    // Read whatever fields you wrote into the raw packet, in the same order.
    uint id = reader.ReadUInt32();
    ArraySegment<byte> payload = reader.ReadArraySegmentWithCountAsBytes();
};
```

**The `Reader` is reused the moment your handler returns.** Copy the values you need inside the callback. Do not keep the `Reader` and read from it later.
