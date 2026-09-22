---
title: "Packet transforms"
---

## Overview

A packet transform rewrites the bytes of every packet on its way to and from a Transport. Use it to layer encryption, compression, obfuscation, or a custom integrity check underneath the engine, without touching any send or receive call site.

This is a Nucleus-only, Pro feature. The interface, the shipped example, and the `TransportManager` hooks that apply it all live in `.Pro.cs` files and are absent from a Free build.

## Implementing IPacketTransform

```csharp
public interface IPacketTransform
{
    uint ReservedBytes { get; }

    bool TryTransform(PacketTransformDirection packetTransformDirection, Connection connection, Channel channel, ReadOnlySpan<byte> source, Span<byte> destination, out int writtenLength);
}
```

`TryTransform` runs once per packet, in each direction:

- `PacketTransformDirection.Outbound` — the packet is leaving the engine, about to be handed to the Transport.
- `PacketTransformDirection.Inbound` — the packet has just arrived from the Transport and has not yet been read.

Read `source`, write the rewritten payload into `destination`, and report how many bytes were written through `writtenLength`. `destination` is always at least `source.Length + ReservedBytes` long, which is enough room for whatever the transform adds.

Return `true` when the rewrite succeeded and `writtenLength` is valid. Return `false` to discard the packet — this is how an inbound transform reports a failed integrity or authentication check. A discarded inbound payload raises `PacketTransformRejectedViolation`, with the `Channel` it arrived on and how many bytes it carried before the transform ran.

`TryTransform` is the hottest user-supplied callback in the engine. Keep it allocation-free.

## Installing it

```csharp
coreManager.TransportManager.PacketTransform = new MyPacketTransform();
```

Set `TransportManager.PacketTransform` before starting the Transport. Both peers must be running an equivalent transform, and both must be running it before either connects — a packet transformed by one side and read raw (or by a mismatched transform) on the other is exactly the case `PacketTransformRejectedViolation` exists for.

## What ReservedBytes costs

`ReservedBytes` is the largest number of bytes the transform may add to an outbound payload. The engine deducts it from the Transport's `MaximumTransmissionUnit` to get the effective transmission unit it packs packets against, so a transformed packet still fits on the wire. `TransportManager.GetMaximumTransmissionUnit` reports this reduced figure, not the Transport's raw configured unit.

## What a transform sees

A transform sees the whole of what the engine hands the Transport, including the engine's own packet header. It sees nothing the Transport adds around that: a handshake or a keep-alive the Transport sends on its own behalf is below this seam and keeps flowing untouched.

## Keying

Key a transform on something both peers already hold — a build key, or something the Transport itself established — never on anything Nucleus negotiates. Nucleus authenticates over ordinary packets, and those cross this seam like any other, so a key that only exists once a session is authenticated has no way to exempt the traffic that authenticates it.

## ExampleXorPacketTransform

`ExampleXorPacketTransform` is the shipped illustration of the shape a transform takes. It masks each payload with a four-byte XOR value, writing that mask ahead of the masked bytes so a fresh mask per packet keeps identical payloads from producing identical packets on the wire.

It provides no security of any kind and must never be used to protect real traffic — the mask ships beside the data it masks, so anyone reading the packet can undo it with no key. Treat it as a template for the length accounting and control flow a real transform needs (an authenticated cipher such as AES-GCM), not as something to ship.

## In Unity

There is no Unity component for this. Set it the same way, through the `TransportManager` reached off `UnityCoreManager.CoreManager`, before starting:

```csharp
unityCoreManager.CoreManager.TransportManager.PacketTransform = new MyPacketTransform();
```

That line is the whole of the Unity story.
