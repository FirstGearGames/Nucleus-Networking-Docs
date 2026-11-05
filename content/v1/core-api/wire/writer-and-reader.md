---
title: "Writer and Reader"
---

`Writer` and `Reader` are what custom serializers and payloads are written against. A `Reader` must read values in the same order, at the same compression level, as the `Writer` wrote them. Both are pooled: rent one, use it, return it.

## Rent and return a Writer

Rent from `WriterPool`:

- `WriterPool.Rent()`: an uninitialized writer, for when there is no `CoreManager` yet.
- `WriterPool.Rent(CoreManager coreManager)`: the usual case.
- `WriterPool.RentByBitCapacity(uint bitCapacity, CoreManager coreManager)` and `RentByByteCapacity(uint byteCapacity, CoreManager coreManager)`: pre-sized, to avoid an early resize. Return these with `ReturnByCapacity`, not `Return`.
- `WriterPool.RentList()`, `RentList(int writerCount)` and `WriterPool.RentDictionary<T0>()`: pooled collections of writers, for building several payloads at once, such as one per observer.

Return to `WriterPool`:

- `Return(Writer? writer)`, or `ReturnAndNullifyReference(ref Writer? writer)` to also null your reference.
- `ReturnByCapacity(Writer? writer)` and `ReturnByCapacityAndNullifyReference(ref Writer? writer)` for capacity-rented writers.
- `Reset(List<Writer?> writers)`, `Return(List<Writer?> writers)` and `ReturnAndNullifyReference(ref List<Writer?> writers)` for a rented list; the last two also return the list.

## Rent and return a Reader

`ReaderPool.Rent` has three forms:

- `ReaderPool.Rent(byte[] packedBytes, byte excessBits, CoreManager coreManager, Connection senderConnection)`: from a byte array plus the count of unused bits in its final byte.
- `ReaderPool.Rent(PackedBytes packedBytes, CoreManager coreManager, Connection senderConnection)`: from a `PackedBytes`.
- `ReaderPool.Rent(CoreManager coreManager, Connection senderConnection)`: an empty reader, for code that adds read spans itself.

Return with `ReaderPool.Return(Reader? reader)` or `ReaderPool.ReturnAndNullifyReference(ref Reader? reader)`. `Reset`, `Return` and `ReturnAndNullifyReference` also have overloads for `List<Reader?>` and `Dictionary<T0, Reader>`.

## Write full values

Every full-value write takes a `CompressionLevel`, defaulting to `Loose`:

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

Floating-point writes add an `accuracy` argument, the precision compression may discard:

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

Collections write their count with the values:

```csharp
void WriteUInt8ArrayWithCountAsBytes(byte[] bytes, CompressionLevel compressionLevel = CompressionLevel.Uncompressed);
void WriteArraySegmentWithCountAsBytes(ArraySegment<byte> value, CompressionLevel compressionLevel = CompressionLevel.Uncompressed);
void WriteListWithCount<T0>(List<T0> value, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteArrayWithCount<T0>(T0[] value, CompressionLevel compressionLevel = CompressionLevel.Loose);
void WriteDictionary<T0, T1>(Dictionary<T0, T1> value, CompressionLevel compressionLevel = CompressionLevel.Loose);
```

`WriteNullable<T0>` writes a nullable value, null included, and `Write<T0>` uses whichever writer is registered for `T0`:

```csharp
void WriteNullable<T0>(T0? value, CompressionLevel compressionLevel = CompressionLevel.Loose) where T0 : struct;
void Write<T0>(T0 value, CompressionLevel compressionLevel = CompressionLevel.Loose);
```

## Write deltas

A delta write writes a value relative to a previous one and returns whether it wrote anything. Under `DeltaCheckMode.Checked`, `false` means the value was unchanged; `DeltaCheckMode.Unchecked` always writes. Delta writes use `Writer.DeltaCompressionLevel` instead of a `CompressionLevel` argument.

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

`TryWriteDelta*` behaves the same whether the member uses `TransmissionMode.Divine` or `TransmissionMode.Interval`.

## Write raw bits and move the position

```csharp
void WriteBits(ulong value, uint bitCount);
void WriteBits(ulong value, uint bitCount, uint position);
void WriteBits(Writer otherWriter);
uint SkipBits(uint bitCount);
uint SetBitBufferIndex(uint value);
```

- `WriteBits(value, bitCount)` writes at the current position and advances it.
- `WriteBits(value, bitCount, position)` writes at an absolute position without moving the current one, for filling in a length or flag once it is known.
- `WriteBits(Writer otherWriter)` appends another writer's bits.
- `SkipBits(bitCount)` reserves space and returns the position it started from.
- `SetBitBufferIndex(value)` jumps to a position and returns the previous one.

Capacity grows only when you ask:

```csharp
void CreateCapacityAsBits(uint bitCount);
void CreateCapacityAsBytes(uint byteCount);
void CreateCapacityForArray(int writeCount);
```

## Get the bytes out

```csharp
uint BitCount { get; }
uint BitIndex { get; }
uint BitCapacity { get; }
uint PackedByteCount { get; }
byte GetExcessBitCount();
ArraySegment<byte> ToPackedByteArraySegment(out byte excessBitCount);
PackedBytes ToPackedBytes();
```

- `BitCount`: bits written so far.
- `BitIndex`: that count's position within its final byte.
- `BitCapacity`: the buffer's current size in bits.
- `PackedByteCount`: how many bytes the written bits fill.
- `GetExcessBitCount()`: unused bits in the final byte.
- `ToPackedByteArraySegment` and `ToPackedBytes`: the written bytes, ready for a transport or a `Reader`.

`PackedBytes`, and its read-only interface `IReadOnlyPackedBytes`, carries the bytes and the excess-bit count. `IReadOnlyWriter` and `IReadOnlyReader` expose the counters and byte extraction without any write or read methods.

## Never trust a Connection read from a payload

```csharp
void WriteConnection(Connection connection, CompressionLevel compressionLevel = CompressionLevel.Loose);
Connection ReadConnection(CompressionLevel compressionLevel = CompressionLevel.Loose);
```

These send a `Connection` by id, and any sender can write any id. Never authorize an action on a `ReadConnection` result alone. The trustworthy sender is the context's sender connection, such as `RpcContext.SenderConnection`, which comes from the transport.

## Read values back

`Reader` has a matching read for every write (`ReadInt8`, `ReadSingle`, `ReadString`, `ReadDelta<T0>` and so on).

- A full read takes the `CompressionLevel` the write used. Reads default to the same level as their writes (`Loose`, including `ReadString`), except `ReadQuaternion`, which has no default and must be given the level.
- A delta read takes the previous value and no `DeltaCheckMode`. It uses `Reader.DeltaCompressionLevel`, which must match the writer's `DeltaCompressionLevel`, or every later read goes wrong.

Passing the level explicitly on both sides is the clearest way to keep a pair in step.

```csharp
CoreManager CoreManager { get; }
Connection Sender { get; }
uint BitsRemaining { get; }
bool HasBitsRemaining { get; }
CompressionLevel DeltaCompressionLevel { get; set; }
```

`Sender` is the connection passed to `ReaderPool.Rent`. `BitsRemaining` and `HasBitsRemaining` say whether there is more to read, and `HasReadSpan` (from `IReadOnlyReader`) says whether at least one read span has been added.
