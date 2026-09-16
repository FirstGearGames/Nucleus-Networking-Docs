---
title: "Custom Comparers"
---
Fish-Networking generates comparers for prediction data to perform internal optimizations, but on occasion certain types cannot have comparers automatically generated.

You may see an error in the console about a type requiring a custom comparer. For example, generics and arrays specifically must have a custom comparer provided.

```csharp
/* For example, this will create an error stating
 * byte[] needs a custom comparer. */
public struct MoveData : IReplicateData
{
    public Vector2 MoveDirection;
    public byte[] CustomData;
    // rest omitted..
}
```

While a comparer could be made automatically for the type `byte[]`, we still require you to create your own as we may not know exactly how you want to compare these types. The code below compares byte arrays by iterating every byte to check for mismatches. Given how often prediction data sends, this could potentially burden the processor.

```csharp
[CustomComparer]
public static bool CompareByteArray(byte[] a, byte[] b)
{
    bool aNull = (a is null);
    bool bNull = (b is null);

    // Both are null.
    if (aNull && bNull)
        return true;
    // One is null, other is not.
    if (aNull != bNull)
        return false;
    // Not same lengths, cannot match.
    if (a.Length != b.Length)
        return false;

    // Both not null and same length, compare bytes.
    int length = a.Length;
    for (int i = 0; i < length; i++)
    {
        // Differs.
        if (a[i] != b[i])
            return false;
    }

    // Fall through, if here everything matches.
    return true;
}
```

The above code is a working example of how to create a custom comparer, but it may not be the most ideal comparer for your needs; this is why we require you to make your own comparer for such types.

Creating your own comparer is simple. Make a new static method with any name and boolean as the return type. Decorate the method with the `[CustomComparer]` attribute. There must also be two parameters, each being the type you want to compare. The method logic can contain whichever code you like.
