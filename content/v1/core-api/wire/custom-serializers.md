---
title: "Writing a Custom Serializer"
---

## When to write one

The source generator emits a full and delta serializer pair for every networked type it can see into. Write your own when you want a specific wire shape for a type instead: a packed encoding, a custom precision trade-off, or a type the generator cannot reach at all. A hand-written serializer always wins over a generated one for the same type.

There are two ways to register a serializer: the attribute route, resolved at compile time by the source generator, and the runtime route, called directly against the generic handler classes. Both end up calling the same `UseWriteHandler` / `UseReadHandler` methods; the attribute route is generated code that calls them for you.

## The attribute route

Mark a static method with one of four attributes:

- `[DefaultWriter]` - the full writer for a type.
- `[DefaultReader]` - the full reader for a type.
- `[DefaultDeltaWriter]` - the delta writer for a type.
- `[DefaultDeltaReader]` - the delta reader for a type.

All four live in `Nucleus.Serializers` and target methods only. The generator checks each attributed method against a fixed signature shape: an extension method on `Writer` (writers) or `Reader` (readers), so the first parameter is `this Writer writer` or `this Reader reader`. A full writer takes the value and a `CompressionLevel`; a full reader returns the value and takes a `CompressionLevel`. A delta writer takes a previous value, a next value and a `DeltaCheckMode`, and returns `bool`; a delta reader takes a previous value and returns the next value.

```csharp
[DefaultWriter]
public static void WriteMyType(this Writer writer, MyType value, CompressionLevel compressionLevel)
{
    // write value's fields through writer
}

[DefaultReader]
public static MyType ReadMyType(this Reader reader, CompressionLevel compressionLevel)
{
    // read fields back through reader and construct MyType
}

[DefaultDeltaWriter]
public static bool TryWriteDeltaMyType(this Writer writer, MyType previousValue, MyType nextValue, DeltaCheckMode deltaCheckMode)
{
    // return true only if something was written
}

[DefaultDeltaReader]
public static MyType ReadDeltaMyType(this Reader reader, MyType previousValue)
{
    // mirror exactly what the delta writer chose to write
}
```

At generation time these become calls into `GenericFullWriter<T0>.UseWriteHandler`, `GenericFullReader<T0>.UseReadHandler`, `GenericDeltaWriter<T0>.UseWriteHandler` and `GenericDeltaReader<T0>.UseReadHandler`, registered as custom. A generated registration for the same type is never allowed to overwrite a hand-written one; the handler classes track this themselves (see below), so the order the two run in at assembly load does not matter.

## The runtime route

The four attributes are convenience over the same generic classes you can call yourself:

- `GenericFullWriter<T0>.UseWriteHandler(WriteHandler, bool isSerializerCustom)`
- `GenericFullReader<T0>.UseReadHandler(ReadHandler, bool isSerializerCustom)`
- `GenericDeltaWriter<T0>.UseWriteHandler(WriteHandler, bool isSerializerCustom)`
- `GenericDeltaReader<T0>.UseReadHandler(ReadHandler, bool isSerializerCustom)`

Each also has an accuracy-aware overload (`WriteWithAccuracyHandler` / `ReadWithAccuracyHandler`, adding a `float accuracy` parameter) for types whose encoding takes a precision hint; a type that does not need one only registers the plain overload.

The delegate shapes:

```csharp
// Nucleus.Serializers.GenericFullWriter<T0>
public delegate void WriteHandler(Writer writer, T0 value, CompressionLevel compressionLevel);
public delegate void WriteWithAccuracyHandler(Writer writer, T0 value, CompressionLevel compressionLevel, float accuracy);

// Nucleus.Serializers.GenericFullReader<T0>
public delegate T0 ReadHandler(Reader reader, CompressionLevel compressionLevel);
public delegate T0 ReadWithAccuracyHandler(Reader reader, CompressionLevel compressionLevel, float accuracy);

// Nucleus.Serializers.GenericDeltaWriter<T0>
public delegate bool WriteHandler(Writer writer, T0? previousValue, T0? nextValue, DeltaCheckMode deltaCheckMode);
public delegate bool WriteWithAccuracyHandler(Writer writer, T0? previousValue, T0? nextValue, DeltaCheckMode deltaCheckMode, float accuracy);

// Nucleus.Serializers.GenericDeltaReader<T0>
public delegate T0 ReadHandler(Reader reader, T0 previousValue);
public delegate T0 ReadWithAccuracyHandler(Reader reader, T0 previousValue, float accuracy);
```

`isSerializerCustom` is what decides precedence. Every `UseWriteHandler` / `UseReadHandler` overload checks its own `IsWriteCustom` / `IsReadCustom` (or the delta equivalents, `IsWriteSerializerCustom` / `IsReadSerializerCustom`) flag first: if a custom handler is already registered, the call is a no-op. Register your handler with `isSerializerCustom: true` and it locks the slot; anything the generator later tries to register for the same type is silently declined. Calling `UseWriteHandler` directly is the same operation the attribute route performs after code generation, so a plugin, a test, or code that runs before the generated assembly-load registration can install a handler exactly the same way:

```csharp
GenericFullWriter<MyType>.UseWriteHandler(WriteMyType, isSerializerCustom: true);
GenericFullReader<MyType>.UseReadHandler(ReadMyType, isSerializerCustom: true);
GenericDeltaWriter<MyType>.UseWriteHandler(TryWriteDeltaMyType, isSerializerCustom: true);
GenericDeltaReader<MyType>.UseReadHandler(ReadDeltaMyType, isSerializerCustom: true);
```

## Why the delta pair has to agree

A delta writer returns `bool`: it may write nothing at all when `DeltaCheckMode.Checked` finds no change to report. The reader has no independent way to know whether a value was written - it only knows what the writer decided. If the reader does not mirror the writer's decision exactly (reading when the writer wrote, and not reading when it didn't), the stream desynchronizes: every read from that point on pulls bits meant for something else, and the corruption goes undetected until values obviously stop making sense.

This is also why testing a delta serializer as a symmetric pair, not writer and reader in isolation, matters more here than almost anywhere else in the engine. "The writer doesn't throw" and "the reader doesn't throw" both pass for a reader that silently reads the wrong value.

## Composing inside Nullable<T>

A member typed `MyType?` needs your full serializer to work under the engine's nullable handling rather than around it. `NullableEncapsulatedChecker<T0>` is how the engine itself detects a `Nullable<>`-encapsulated type: `GetIsNullable()` and `GetUnderlyingType()` return whether `T0` is `Nullable<>` and, if so, the underlying type.

`Writer` exposes `WriteNullable<T0>` and `TryWriteNullable<T0>` for the full and delta paths on any `struct`. Write your full and delta writer/reader for the underlying value type as usual; `WriteNullable` / `TryWriteNullable` wrap it with the presence bit and dispatch to your registered handler for the underlying type. You do not write a separate serializer for the `Nullable<T0>` form - the underlying type's serializer is what composes.

## Helpers to lean on

Two building blocks exist so you don't hand-roll the same encoding twice:

- **`ByteArrayDifferenceSerializer`** - `TryWrite(Writer, byte[] previousValue, byte[] nextValue)` and `Read(Reader, byte[] previousValue, byte[] result)` encode the per-byte difference between two same-length byte arrays: one flag bit per index, plus eight uncompressed bits when that byte changed. Both peers must already know the array length out of band; length is not part of the encoding. Reach for this inside a delta writer for any type that boils down to a fixed-length byte buffer.
- **`DecimalPacked`** - the struct the engine's own `decimal` writer and reader convert through (`Writer.Full.cs`, `Reader.Full.cs`) to pack a `decimal` more tightly than its raw bit representation, taking an accuracy hint via its `DecimalPacked(decimal value, float accuracy)` constructor and converting back with `AsDecimal(float accuracy)`. Use it wherever a type you're serializing embeds a `decimal` and you want the same packing rather than writing the four raw ints.

## Known by-design refusals

Some framework types intentionally have no delta serializer. `Matrix4x4` (`Writer.TryWriteMatrix4X4`, `Reader.ReadDeltaMatrix4X4`), `Channel` (`Writer.TryWriteDeltaChannel`, `Reader.ReadDeltaChannel`), `NetworkSystemGroup` (`Writer.TryWriteDeltaNetworkSystemGroup`, `Reader.ReadDeltaNetworkSystemGroup`), and arrays through `Writer.TryWriteDeltaArrayAndCount<T0>` all throw rather than attempt an encoding. These are not hot-path types, and a silent best-effort delta encoding for them would be more likely to mis-encode than to save bandwidth. If your own type is in the same position - rarely sent, or without a meaningful "difference" - throwing from your delta writer is the correct behavior, not a gap to fill in.

## Verifying it

`Nucleus.Tests/Serializers` is where round-trip and delta-pair symmetry coverage for the framework's own serializers lives; a custom serializer's own test should follow the same shape. Write through a real `Writer`, initialized with `Initialize(coreManager: null)`, and read back through a real `Reader` initialized from `writer.ToPackedBytes()` - never assert against the writer's return value alone, since "wrote successfully" and "wrote the right bytes" are different claims. For a delta pair, write a run of values across a single `Writer` and read the same run back across a single `Reader`, asserting each value in sequence; a bug that only desynchronizes the stream after the first mismatch will not show up on a single write/read pair.
