---
title: "Writing a Custom Serializer"
---

## Write one only when you need a specific encoding

Every networked type the generator can reach is serialized for you. Write your own serializer for a packed encoding, a custom precision trade-off, or a type the generator cannot reach. A hand-written serializer always wins over a generated one for the same type, whichever is registered first.

If the type only needs to be visible to the generator, use a marker struct instead; see [Reaching Types You Cannot Annotate](./external-network-types.md).

## Register with attributes

Mark static extension methods with these attributes from `Nucleus.Serializers`:

| Attribute | Method shape |
|---|---|
| `[DefaultWriter]` | Extends `Writer`; takes the value and a `CompressionLevel`. |
| `[DefaultReader]` | Extends `Reader`; takes a `CompressionLevel` and returns the value. |
| `[DefaultDeltaWriter]` | Extends `Writer`; takes a previous value, a next value and a `DeltaCheckMode`, and returns `bool`. |
| `[DefaultDeltaReader]` | Extends `Reader`; takes a previous value and returns the next value. |

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

The generator checks each method's signature and registers it for you.

## Register at runtime

The attributes call these methods, which you can also call yourself, for example from a plugin or code that runs early:

- `GenericFullWriter<T0>.UseWriteHandler(WriteHandler, bool isSerializerCustom)`
- `GenericFullReader<T0>.UseReadHandler(ReadHandler, bool isSerializerCustom)`
- `GenericDeltaWriter<T0>.UseWriteHandler(WriteHandler, bool isSerializerCustom)`
- `GenericDeltaReader<T0>.UseReadHandler(ReadHandler, bool isSerializerCustom)`

Each also has an overload taking `WriteWithAccuracyHandler` or `ReadWithAccuracyHandler`, which add a `float accuracy` parameter, for types whose encoding takes a precision hint.

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

Pass `isSerializerCustom: true`. Once registered, the handler is never replaced, neither by a generated serializer nor by a later registration of your own, so register each handler once.

```csharp
GenericFullWriter<MyType>.UseWriteHandler(WriteMyType, isSerializerCustom: true);
GenericFullReader<MyType>.UseReadHandler(ReadMyType, isSerializerCustom: true);
GenericDeltaWriter<MyType>.UseWriteHandler(TryWriteDeltaMyType, isSerializerCustom: true);
GenericDeltaReader<MyType>.UseReadHandler(ReadDeltaMyType, isSerializerCustom: true);
```

## Make the delta reader mirror the delta writer

A delta writer may write nothing when `DeltaCheckMode.Checked` finds no change. The reader must read exactly when the writer wrote and skip exactly when it did not. If they disagree, every later read in the stream returns wrong values, with no error.

## Nullable types need no extra serializer

A member typed `MyType?` uses your serializer for `MyType`. `Writer.WriteNullable<T0>` and `TryWriteNullable<T0>` wrap the underlying type's registered handler for any `struct`. `NullableEncapsulatedChecker<T0>.GetIsNullable()` and `GetUnderlyingType()` tell you whether `T0` is `Nullable<>` and, if so, its underlying type.

## Reuse the built-in helpers

- **`ByteArrayDifferenceSerializer`**: `TryWrite(Writer, byte[] previousValue, byte[] nextValue)` and `Read(Reader, byte[] previousValue, byte[] result)` write and read the difference between two same-length byte arrays. The length is not sent, so both peers must already know it. Use it inside a delta writer for any type that is a fixed-length byte buffer.
- **`DecimalPacked`**: a compact `decimal`. Build it with `DecimalPacked(decimal value, float accuracy)` and convert back with `AsDecimal(float accuracy)`.

## Some types have no delta serializer by design

`Matrix4x4` (`Writer.TryWriteMatrix4X4`, `Reader.ReadDeltaMatrix4X4`), `Channel` (`Writer.TryWriteDeltaChannel`, `Reader.ReadDeltaChannel`), `NetworkSystemGroup` (`Writer.TryWriteDeltaNetworkSystemGroup`, `Reader.ReadDeltaNetworkSystemGroup`) and arrays through `Writer.TryWriteDeltaArrayAndCount<T0>` all throw. If your own type has no meaningful difference to send, throwing from its delta writer is correct.

## Test it as a round trip

1. Write through a real `Writer`, initialized with `Initialize(coreManager: null)`.
2. Read back through a real `Reader` initialized from `writer.ToPackedBytes()`.
3. For a delta pair, write a run of values on one `Writer` and read the same run back on one `Reader`, checking each value in order. A single write and read will not catch a reader that falls out of step.

Never check only the writer's return value; writing successfully is not the same as writing the right bytes.
