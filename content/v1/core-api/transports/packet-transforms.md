---
title: "Packet transforms"
---

A packet transform rewrites the bytes of every packet to and from a transport, so you can add encryption, compression, obfuscation or an integrity check without changing any send or receive code. It is a Pro feature; Free builds have no `IPacketTransform` or the `TransportManager` hooks.

A transform sees everything the engine hands the transport. It does not see packets the transport sends on its own, such as its handshake or keep-alives.

## Implement IPacketTransform

```csharp
public interface IPacketTransform
{
    uint ReservedBytes { get; }

    bool TryTransform(PacketTransformDirection packetTransformDirection, Connection connection, Channel channel, ReadOnlySpan<byte> source, Span<byte> destination, out int writtenLength);
}
```

`TryTransform` runs once per packet, in each direction:

- `PacketTransformDirection.Outbound`: the packet is about to go to the transport.
- `PacketTransformDirection.Inbound`: the packet just arrived from the transport and has not been read.

Read `source`, write the result into `destination`, and set `writtenLength`. `destination` is always at least `source.Length + ReservedBytes` long. Keep it allocation-free; it runs for every packet.

- Return `true` when the rewrite succeeded.
- Return `false` to discard the packet, for example when an inbound integrity check fails. A discarded inbound packet raises `PacketTransformRejectedViolation`, carrying the `Channel` and its length before the transform ran.

`ReservedBytes` is the most the transform may add to an outbound packet. It comes out of the transport's `MaximumTransmissionUnit`; `TransportManager.GetMaximumTransmissionUnit` reports the reduced figure.

## Install it on both peers before connecting

```csharp
coreManager.TransportManager.PacketTransform = new MyPacketTransform();
```

Set `TransportManager.PacketTransform` before starting the transport. Both peers must run an equivalent transform before either connects; a mismatch is what `PacketTransformRejectedViolation` reports.

In Unity there is no component. Set it the same way before starting:

```csharp
unityCoreManager.CoreManager.TransportManager.PacketTransform = new MyPacketTransform();
```

## Key it on something both peers already hold

Use a build key, or something the transport itself established. Never use anything Nucleus negotiates: authentication travels through the transform too, so a key that only exists after authentication cannot unlock the packets that authenticate.

## Do not ship ExampleXorPacketTransform

`ExampleXorPacketTransform` shows the length accounting and control flow a transform needs. It provides no security, because anyone reading the packet can undo it without a key. Use an authenticated cipher such as AES-GCM for real traffic.
