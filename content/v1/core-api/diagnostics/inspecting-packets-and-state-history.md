---
title: "Reading serialization history (and the raw-packet test hook)"
---

## When the log has run out

Some faults only show up as "the client has the wrong value" with nothing in the log to explain why. Before guessing, ask the server two separate questions: what did it decide to serialize, and — far more rarely — what actually left the socket. These are answered by different tools, and conflating them wastes time.

## What the server believes it sent

`SystemManager` keeps a rolling history of which `NetworkSystem` ids it serialized as changed or spawned, per tick, bounded by `SystemManager.SerializationHistoryTickCount`. Anything older than that window is gone; there is no going further back.

- `IsSystemRecentlySerialized(uint systemId)` — was this system serialized within the window, as of the current tick.
- `GetRecentlySerializedSystemIds(HashSet<uint> collectedSystemIds)` — every system id serialized within the window.
- `TryGetSerializedSystemIds(uint tick, HashSet<uint> collectedSystemIds)` — every system id serialized on one specific tick; returns `false` if that tick has aged out of the window.
- `GetSerializedSystemIdsAfterTick(uint afterTick, HashSet<uint> collectedSystemIds)` — every system id serialized on any tick after a baseline; returns `false` if part of that range has already aged out, meaning the results are incomplete rather than empty.

```csharp
HashSet<uint> changedSystemIds = HashSetPool<uint>.Rent();

bool isComplete = coreManager.SystemManager.GetSerializedSystemIdsAfterTick(lastKnownGoodTick, changedSystemIds);

foreach (uint systemId in changedSystemIds)
{
    if (coreManager.SystemManager.TryGetSystemReference(systemId, out NetworkSystem networkSystem))
        Logger.LogInfo($"Serialized: {networkSystem.AsString()}");
}

HashSetPool<uint>.Return(changedSystemIds);
```

If `isComplete` comes back `false`, the window aged past part of the range you asked for — treat the collected ids as a lower bound, not the whole answer.

## Turning ids into something readable

A raw `uint` system id or connection id in a log line is almost never enough to place a fault — it doesn't say which object, which peer, or whether the reference was even valid at the time. Resolve it first:

- `ConnectionExtensions.AsString(this Connection connection)` — describes a `Connection`, or returns `"IsNull"` if it is null.
- `NetworkSystemExtensions.AsString(this NetworkSystem networkSystem)` — describes a `NetworkSystem`, or returns `"IsNull"` if it is null.

Use these in every log line that names a connection or a system, not just when debugging. `TryGetSystemReference` (above) is how you go from a bare id back to the `NetworkSystem` these extensions describe.

## Rule for reading a payload

An id inside a packet is a claim, not a fact. Never trust a sender id read out of a payload as "who sent this." The sender is whatever the engine resolved the connection to be at receipt — the `Connection` handed to you by the read path — never a value pulled out of the bytes themselves. If those two disagree, the resolved connection is the truth and the payload value is the anomaly you're investigating.

## The raw-packet test hook

`TransportManager.RawPacketReceived` (`RawPacketReceivedHandler(Connection sendingConnection, Reader reader)`) fires only for `PacketType.Raw`. This is not a tap on ordinary arriving traffic.

`PacketType.Raw` is a DEBUG-only packet type — it doesn't exist in the enum in Release at all. The engine itself never sends one; the only producers are the transport test suites, which hand-write a `PacketType.Raw` header themselves to exercise a transport directly (see `Nucleus.Tests/Transports/SynapseTransportTests.cs`). If you want to see what a transport actually put on the wire, you construct and send a raw packet yourself and subscribe to this event to observe it arrive — you don't get it for free by listening in on real gameplay traffic.

```csharp
fixture.CoreManager.TransportManager.RawPacketReceived += (sendingConnection, reader) =>
{
    // Read whatever fields you wrote into the raw packet, in the same order.
    uint id = reader.ReadUInt32();
    ArraySegment<byte> payload = reader.ReadArraySegmentWithCountAsBytes();
};
```

## The cost of looking

The `Reader` handed to `RawPacketReceived` belongs to the receive loop, not to you. It is reused on the next packet the moment your handler returns. Copy whatever values you need out of it inside the callback; do not stash the `Reader` reference itself and read from it later.
