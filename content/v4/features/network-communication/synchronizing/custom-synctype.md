With a customized SyncType you can decide how and what data to synchronize, and make optimizations as you see fit.

For example: if you have a data container with many variables you probably don't want to send the entire container when you change it, as a SyncVar would. By making a custom SyncType you can customize the behavior entirely; this is how other SyncTypes work.

```csharp
/* If one of these values change you
 * probably don't want to send the
 * entire container. A custom SyncType
 * is perfect for only sending what is changed. */
[System.Serializable]
public struct MyContainer
{
    public int LeftArmHealth;
    public int RightArmHealth;
    public int LeftLegHealth;
    public int RightLegHealth;
}
```

Custom SyncTypes follow the same rules as other SyncTypes. Internally other SyncTypes inherit from `SyncBase`, and your type must as well. In addition, you must implement the `ICustomSync` interface.

```csharp
public class SyncMyContainer : SyncBase, ICustomSync
{
    /* If you intend to serialize your type
     * as a whole at any point in your custom
     * SyncType and would like the automatic
     * serializers to include it then use
     * GetSerializedType() to return the type.
     * In this case, the type is MyContainer.
     * If you do not need a serializer generated
     * you may return null. */
    public object GetSerializedType() => typeof(MyContainer);
}

public class YourClass
{
    private readonly SyncMyContainer _myContainer = new();
}
```

Given how flexible a custom SyncType may be there is not a one-size-fits-all example. You may view several custom examples within your FishNet import under `FishNet/Demos/CustomSyncType`.
