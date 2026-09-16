Are useful where an automatic serializer may not be possible, or where you want data to be serialized in a specific manner.

When creating a custom serializer there are a few important things to remember. When you follow the proper steps your custom serializer will be found and used by Fish-Networking. Your custom serializers can also override automatic serializers, but not included ones.

- Your method must be `static`, and within a `static` class.
- Writing method names must begin with `Write`.
- Reading method names must begin with `Read`.
- The first parameter must be `this Writer` for writers, and `this Reader` for readers.
- Data must be read in the same order it is written.

Although `Vector2` is already supported, the example below uses a `Vector2` for simplicity's sake.

```csharp
// Write each axis of a Vector2.
public static void WriteVector2(this Writer writer, Vector2 value)
{
    writer.WriteSingle(value.x);
    writer.WriteSingle(value.y);
}

// Read and return a Vector2.
public static Vector2 ReadVector2(this Reader reader)
{
    return new Vector2()
    {
        x = reader.ReadSingle(),
        y = reader.ReadSingle()
    };
}
```

Custom serializers are more commonly used for conditional situations where what you write may change depending on the data values. Here is a more complex example where certain data is only written when it's needed.

```csharp
/* This is the type we are going to write.
 * We will save data and populate default values
 * by not writing energy/energy regeneration if
 * the enemy does not have energy. */
public struct Enemy
{
    public bool HasEnergy;
    public float Health;
    public float Energy;
    public float EnergyRegeneration;
}

public static void WriteEnemy(this Writer writer, Enemy value)
{
    writer.WriteBoolean(value.HasEnergy);
    writer.WriteSingle(value.Health);

    // Only need to write energy and energy regeneration if HasEnergy is true.
    if (value.HasEnergy)
    {
        writer.WriteSingle(value.Energy);
        writer.WriteSingle(value.EnergyRegeneration);
    }
}

public static Enemy ReadEnemy(this Reader reader)
{
    Enemy e = new Enemy();
    e.HasEnergy = reader.ReadBoolean();
    e.Health = reader.ReadSingle();

    // If there is energy also read energy values.
    if (e.HasEnergy)
    {
        e.Energy = reader.ReadSingle();
        e.EnergyRegeneration = reader.ReadSingle();
    }

    return e;
}
```

Often when creating a custom serializer you want to use it across your entire project, and all assemblies. Without taking any action further your custom serializer would only be used on the assembly it is written. Presumably, that's probably not what you want.

But making a custom serializer work across all assemblies is very simple. Simply add the `[UseGlobalCustomSerializer]` attribute to the type your custom serializer is for, and done!

```csharp
[UseGlobalCustomSerializer]
public struct Enemy
{
    public bool HasEnergy;
    public float Health;
    public float Energy;
    public float EnergyRegeneration;
}
```
