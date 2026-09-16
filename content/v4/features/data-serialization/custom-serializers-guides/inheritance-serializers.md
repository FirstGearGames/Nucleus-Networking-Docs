---
title: "Inheritance Serializers"
description: "Learn how to serialize classes and their children classes."
---

Another frequently asked question is how to handle serialization for classes which are inherited by multiple other classes. These are often used to allow RPCs to use the base class as a parameter, while permitting other inheriting types to be used as arguments. This approach is similar to [Interface Serializers](interface-serializers.md).

## Class example

Here is an example of a class you want to serialize, and two other types which inherit it.

```csharp
public class Item : ItemBase
{
    public string ItemName;
}

public class Weapon : Item
{
    public int Damage;
}

public class Currency : Item
{
    public byte StackSize;
}

/* This is a wrapper to prevent endless loops in
 * your serializer. Why this is used is explained
 * further down. */
public abstract class ItemBase {}
```

Using an RPC which can take all of the types above might look something like this.

```csharp
public void DoThing()
{
    Weapon wp = new Weapon()
    {
        ItemName = "Dagger",
        Damage = 50,
    };
    ObsSendItem(wp);
}

[ObserversRpc]
private void ObsSendItem(ItemBase ib)
{
    if (ib is Weapon wp)
        Debug.Log($"Recv: Item name {wp.ItemName}, damage value {wp.Damage}.");
}
```

### Creating the writer

Since you are accepting `ItemBase` through your RPC you must handle the different possibilities of what is being sent.

> [!WARNING]
> When using this approach it is very important that you check for the child-most types first. For example: Weapon is before Item, and so is Currency, so those two are checked first. Just as if you had `Melee : Weapon`, then Melee would be before Weapon, and so on.

```csharp
public static void WriteItembase(this Writer writer, ItemBase ib)
{
    if (ib is Weapon wp)
    {
        // 1 will be the identifier for the reader that this is Weapon.
        writer.WriteByte(1);
        writer.Write(wp);
    }
    else if (ib is Currency cc)
    {
        writer.WriteByte(2);
        writer.Write(cc);
    }
    else if (ib is Item it)
    {
        writer.WriteByte(3);
        writer.Write(it);
    }
}

public static ItemBase ReadItembase(this Reader reader)
{
    byte clsType = reader.ReadByte();
    if (clsType == 1)
        return reader.Read<Weapon>();
    else if (clsType == 2)
        return reader.Read<Currency>();
    else if (clsType == 3)
        return reader.Read<Item>();
    // Unhandled, this would probably result in read errors.
    else
        return null;
}
```

> [!TIP]
> You can still create custom serializers for individual classes in addition to encapsulating ones as shown! If for example you had a custom serializer for Currency then using the code above would use your serializer for Currency rather than the one Fish-Networking generates.

Finally, disclosing why we made the `ItemBase` class. The sole purpose of `ItemBase` is to prevent an endless loop in the reader. Imagine if we were able to return only `Item` and we were also using that as our base. Your reader might look like this:

```csharp
public static Item ReadItem(this Reader reader)
{
    byte clsType = reader.ReadByte();
    if (clsType == 1)
        return reader.Read<Weapon>();
    else if (clsType == 2)
        return reader.Read<Currency>();
    else if (clsType == 3)
        return reader.Read<Item>(); // ← calls ReadItem again → infinite loop!
    else
        return null;
}
```

The line `return reader.Read<Item>();` is the problem. By calling read on the same type as the serializer you would in result call the `ReadItem` method again, and then the line `return reader.Read<Item>()` again, and then `ReadItem` again — endless loop.

Having a base class (`ItemBase`) which cannot be returned ensures no endless loop.
