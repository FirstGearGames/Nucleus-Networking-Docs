---
title: "Writer and Reader"
---

## Overview

`Writer` and `Reader` are the bit-level building blocks every Nucleus serializer, RPC struct, and transport is written against. A `Writer` packs values onto a growable bit buffer; a matching `Reader` walks the same buffer back out, in the same order, at the same compression level. Both are pooled types: rent one, write or read, then return it.

## Renting and returning a Writer

`WriterPool` is the entry point. It never allocates a `new Writer()` for you to hold onto past the call.

- `WriterPool.Rent()` - an uninitialized writer, for cases with no `CoreManager` yet.
- `WriterPool.Rent(CoreManager coreManager)` - the common case; initializes the writer against that manager.
- `WriterPool.RentByBitCapacity(uint bitCapacity, CoreManager coreManager)` / `RentByByteCapacity(uint byteCapacity, CoreManager coreManager)` - rent from a capacity-bucketed pool instead of the general one, pre-sized to avoid an early buffer resize. Buckets are 1000-byte windows; a writer rented this way should be returned with `ReturnByCapacity`, not `Return`, so it goes back into the same bucket.
- `WriterPool.RentList()` / `RentList(int writerCount)` and `WriterPool.RentDictionary<T0>()` - pooled collections of writers, for code that needs to build several payloads at once (for example, one writer per observer).

Returning:

- `WriterPool.Return(Writer? writer)` - the general-pool counterpart to `Rent()` / `Rent(CoreManager)`.
- `WriterPool.ReturnAndNullifyReference(ref Writer? writer)` - returns and nulls the caller's reference in one call, so a stale reference can't be reused after return.
- `WriterPool.ReturnByCapacity(Writer? writer)` / `ReturnByCapacityAndNullifyReference(ref Writer? writer)` - the counterpart to the `RentByBitCapacity` / `RentByByteCapacity` bucketed pool.
- `WriterPool.Reset(List<Writer?> writers)` / `Return(List<Writer?> writers)` / `ReturnAndNullifyReference(ref List<Writer?> writers)` - return every writer in a rented list (and, for the last two, the list itself).

## Renting and returning a Reader

`ReaderPool` is not a mirror of `WriterPool`. There is no capacity-bucketed rent or return on the reader side - a reader's size is fixed by the bytes it was handed, so there's nothing to pre-size. Instead, `ReaderPool.Rent` comes in three forms depending on what you're initializing from:

- `ReaderPool.Rent(byte[] packedBytes, byte excessBits, CoreManager coreManager, Connection senderConnection)` - from a raw byte array plus the excess-bit count in its final byte.
- `ReaderPool.Rent(PackedBytes packedBytes, CoreManager coreManager, Connection senderConnection)` - from an already-built `PackedBytes`.
- `ReaderPool.Rent(CoreManager coreManager, Connection senderConnection)` - an empty reader, for code that will add read spans itself.

Returning:

- `ReaderPool.Return(Reader? reader)` / `ReaderPool.ReturnAndNullifyReference(ref Reader? reader)`.
- `ReaderPool.Reset` / `Return` / `ReturnAndNullifyReference` overloads for both `List<Reader?>` and `Dictionary<T0, Reader>`.

## Writing values

Every full-value write method takes a `CompressionLevel` (`Aggressive`, `Tight`, `Loose`, or `Uncompressed`), defaulting to `Loose`. The numeric families:

```csharp
void WriteInt8(sbyte value, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteUInt8(byte value, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteInt16(short value, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteUInt16(ushort value, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteInt32(int value, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteUInt32(uint value, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteInt64(long value, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteUInt64(ulong value, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteBoolean(bool value, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteChar(char value, CompressionLevel compressionLevel = CompressionLevel.Loose);
```

`WriteSingle`, `WriteDouble`, and `WriteDecimal` add an `accuracy` argument, which controls how much precision the compression is allowed to discard:

```csharp
void WriteSingle(float value, CompressionLevel compressionLevel = CompressionLevel.Loose, float accuracy = DefaultFloatingAccuracyAsSingle);
void WriteDouble(double value, CompressionLevel compressionLevel = CompressionLevel.Loose, float accuracy = DefaultFloatingAccuracyAsSingle);
void WriteDecimal(decimal value, CompressionLevel compressionLevel = CompressionLevel.Loose, float accuracy = DefaultFloatingAccuracyAsSingle);
```

Other full-value writes:

```csharp
void WriteString(string value, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteGuid(Guid value, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteDateTime(DateTime dateTime, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteMatrix4X4(Matrix4x4 value, CompressionLevel compressionLevel = CompressionLevel.Loose, float accuracy = DefaultFloatingAccuracyAsSingle);
void WriteQuaternion(Quaternion value, CompressionLevel compressionLevel = CompressionLevel.Loose, float accuracy = DefaultQuaternionAccuracyAsSingle);
```

Collections write their count alongside the values:

```csharp
void WriteUInt8ArrayWithCountAsBytes(byte[] bytes, CompressionLevel compressionLevel = CompressionLevel.Uncompressed);
void WriteArraySegmentWithCountAsBytes(ArraySegment<byte> value, CompressionLevel compressionLevel = CompressionLevel.Uncompressed);
void WriteListWithCount<T0>(List<T0> value, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteArrayWithCount<T0>(T0[] value, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteDictionary<T0, T1>(Dictionary<T0, T1> value, CompressionLevel compressionLevel = CompressionLevel.Loose);
```

`WriteNullable<T0>` writes a presence flag then the value:

```csharp
void WriteNullable<T0>(T0? value, CompressionLevel compressionLevel = CompressionLevel.Loose) where T0 : struct;
```

And the generic form dispatches to whichever writer is registered for `T0`:

```csharp
void Write<T0>(T0 value, CompressionLevel compressionLevel = CompressionLevel.Loose);
```

This is what a hand-rolled struct serializer or custom transport payload is built from.

## Writing deltas

The delta family writes a value only relative to a previous one, and every method returns whether anything was actually written - `false` means the value was unchanged and nothing landed on the wire (under `DeltaCheckMode.Checked`; `DeltaCheckMode.Unchecked` always writes). These take a `DeltaCheckMode` instead of a `CompressionLevel` - the compression level used is `Writer.DeltaCompressionLevel`.

```csharp
bool TryWriteDeltaInt8(sbyte previousValue, sbyte nextValue, DeltaCheckMode deltaCheckMode);
bool TryWriteDeltaUInt8(byte previousValue, byte nextValue, DeltaCheckMode deltaCheckMode);
bool TryWriteDeltaInt16(short previousValue, short nextValue, DeltaCheckMode deltaCheckMode);
bool TryWriteDeltaUInt16(ushort previousValue, ushort nextValue, DeltaCheckMode deltaCheckMode);
bool TryWriteDeltaInt32(int previousValue, int nextValue, DeltaCheckMode deltaCheckMode);
bool TryWriteDeltaUInt32(uint previousValue, uint nextValue, DeltaCheckMode deltaCheckMode);
bool TryWriteDeltaInt64(long previousValue, long nextValue, DeltaCheckMode deltaCheckMode);
bool TryWriteDeltaUInt64(ulong previousValue, ulong nextValue, DeltaCheckMode deltaCheckMode);
bool TryWriteDeltaSingle(float previousValue, float nextValue, DeltaCheckMode deltaCheckMode, float accuracy = DefaultFloatingAccuracyAsSingle);
bool TryWriteDeltaDouble(double previousValue, double nextValue, DeltaCheckMode deltaCheckMode, float accuracy = DefaultFloatingAccuracyAsSingle);
bool TryWriteDeltaDecimal(decimal previousValue, decimal nextValue, DeltaCheckMode deltaCheckMode, float accuracy = DefaultFloatingAccuracyAsSingle);
bool TryWriteDeltaString(string previousValue, string nextValue, DeltaCheckMode deltaCheckMode);
bool TryWriteDeltaGuid(Guid previousValue, Guid nextValue, DeltaCheckMode deltaCheckMode);
bool TryWriteDeltaDateTime(DateTime previousValue, DateTime nextValue, DeltaCheckMode deltaCheckMode);
bool TryWriteDeltaQuaternion(Quaternion previousValue, Quaternion nextValue, DeltaCheckMode deltaCheckMode, float accuracy = DefaultQuaternionAccuracyAsSingle);
bool TryWriteDelta<T0>(T0 previousValue, T0 nextValue, DeltaCheckMode deltaCheckMode);
```

A member written this way can choose between `TransmissionMode.Divine` and `TransmissionMode.Interval`. Divine can go quiet for stretches where Interval would still send on every tick; Interval sends on a fixed cadence regardless of whether the value moved. Both are black boxes from the writer's side - `TryWriteDelta*` behaves the same either way, returning whether it wrote.

## Raw bits and positioning

Below the typed writes, a `Writer` is a flat bit buffer you can address directly:

```csharp
void WriteBits(ulong value, uint bitCount);
void WriteBits(ulong value, uint bitCount, uint position);
void WriteBits(Writer otherWriter);
uint SkipBits(uint bitCount);
uint SetBitBufferIndex(uint value);
```

`WriteBits(value, bitCount)` writes at the current position and advances it. The positional overload writes `bitCount` bits at an absolute `position` without moving the current write index - useful for patching a length or flag written earlier once the real value is known. `WriteBits(Writer otherWriter)` appends another writer's full bit buffer onto this one. `SkipBits(bitCount)` advances the position by `bitCount` without writing anything (reserving space) and returns the position it started from; `SetBitBufferIndex(value)` jumps the write position directly and also returns the prior position - both are how you go back and fill in a reserved span with `WriteBits(value, bitCount, position)`.

Capacity is grown explicitly, not implicitly per write:

```csharp
void CreateCapacityAsBits(uint bitCount);
void CreateCapacityAsBytes(uint byteCount);
void CreateCapacityForArray(int writeCount);
```

## Getting the bytes out

```csharp
uint BitCount { get; }
uint BitIndex { get; }
uint BitCapacity { get; }
uint PackedByteCount { get; }
byte GetExcessBitCount();
ArraySegment<byte> ToPackedByteArraySegment(out byte excessBitCount);
PackedBytes ToPackedBytes();
```

`BitCount` is the number of bits written so far; `BitIndex` is that count's position within its final byte; `BitCapacity` is the buffer's current allocated size in bits; `PackedByteCount` is how many bytes the written bits pack into. `GetExcessBitCount()` returns how many bits of padding the final byte carries. `ToPackedByteArraySegment` and `ToPackedBytes` both hand back the written bits - as a raw `ArraySegment<byte>` with the excess count out-parameter, or wrapped in a `PackedBytes` struct - ready to hand to a transport or a `Reader`.

`PackedBytes` (and its read-only interface, `IReadOnlyPackedBytes`) is the value type that carries those bytes plus the excess-bit count between a writer and a reader, or across a transport boundary.

For a surface that must not mutate the writer or reader it wraps, use `IReadOnlyWriter` and `IReadOnlyReader` - read-only views exposing the counters and byte-extraction methods without any write or read methods.

## Connections on the wire

```csharp
void WriteConnection(Connection connection, CompressionLevel compressionLevel = CompressionLevel.Loose);
Connection ReadConnection(CompressionLevel compressionLevel = CompressionLevel.Loose);
```

These write and read a `Connection` reference by id. Treat that id as a claim, not a fact: anyone can write any connection id into a payload they send. The only trustworthy answer to "who actually sent this" is the context's sender connection - `Managers.Rpc.RpcContext.SenderConnection` - which comes from the transport, not from anything inside the payload. Never authorize an action based on a `ReadConnection` result alone.

## Reading values back

A `Reader` mirrors the writer's typed reads one for one (`ReadInt8`, `ReadSingle`, `ReadString`, `ReadDelta<T0>`, and so on). A full read takes the `CompressionLevel` the write used. A delta read takes the previous value and no `DeltaCheckMode`; its compression level is `Reader.DeltaCompressionLevel`. Pass the level explicitly on both sides rather than relying on the defaults, because they do not always match: `WriteString` defaults to `Loose` while `ReadString` defaults to `Uncompressed`, and `ReadQuaternion` has no default level at all. Beyond the per-value reads, a `Reader` carries:

```csharp
CoreManager CoreManager { get; }
Connection Sender { get; }
uint BitsRemaining { get; }
bool HasBitsRemaining { get; }
CompressionLevel DeltaCompressionLevel { get; set; }
```

`Sender` is the connection the reader was initialized with (`ReaderPool.Rent(..., senderConnection)`). `BitsRemaining` and `HasBitsRemaining` tell you whether there's more to read; there is no `ReadSpan` property on `Reader` - `ReadSpan` is a separate internal type, and the reader instead exposes `HasReadSpan` (from `IReadOnlyReader`) to say whether at least one has been added. `DeltaCompressionLevel` must match the value the writer used for its `TryWriteDelta*` calls, or the delta reads will decode incorrectly and desync the rest of the stream.
