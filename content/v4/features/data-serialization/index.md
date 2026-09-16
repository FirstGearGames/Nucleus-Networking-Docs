---
title: "Data Serialization"
---
Serialization and deserialization of data for the purpose of sending it across the network.

Anytime you use a type within a communication, Fish-Networking automatically recognizes you wish to send the type over the network and will create a serializer for it. FishNet will only attempt to automatically serialize public fields and properties. You do not need to perform any extra steps for this process, but if you would like to exclude such fields from being serialized use `[ExcludeSerialization]` above the field.

For example, `Name` and `Level` will be sent over the network but not `Victories`.

```csharp
public class PlayerStat
{
    public string Name;
    public int Level;
    [ExcludeSerialization]
    public int Victories;
}

[ServerRpc]
public void RpcPlayerStats(PlayerStat stats) {}
```

Fish-Networking is also capable of serializing inherited values. In the type `MonsterStat` below, `Health`, `Name`, and `Level` will automatically serialize.

```csharp
public class Stat
{
    public float Health;
}

public class MonsterStat : Stat
{
    public string Name;
    public int Level;
}
```

In very rare cases a data type cannot be automatically serialized; a `Sprite` is a good example of this. It would be very difficult and expensive to serialize the actual image data and send that over the network. Instead, you could store your sprites in a collection and send the collection index, or perhaps you could create a custom serializer.

> **Tip:** FishNet should be able to automatically serialize many basic C# and Unity types as well as classes and structs made with serializable types.

## The ExcludeSerialization Attribute

This attribute is part of the `FishNet.CodeGenerating` namespace, and may be used to prevent a field from being serialized by FishNet's automatic serializer and thus sent over the network when using your own types.

```csharp
public class PlayerStats
{
    public float Health;
    public float MoveSpeed;

    /* In this example ControllerIndex is only used
     * for local multiplayer. This data does not need to be sent
     * over the network so it's been marked with ExcludeSerialization. */
    [ExcludeSerialization]
    public int ControllerIndex;
}
```
