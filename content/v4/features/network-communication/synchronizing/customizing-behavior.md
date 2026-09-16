There are settings and attributes unique to SyncTypes which allow various ways of customizing your SyncType.

## SyncTypeSettings

`SyncTypeSettings` can be initialized with any SyncType to define the default settings of your SyncType.

```csharp
// Custom settings are optional.
// This is an example of declaring a SyncVar without custom settings.
private readonly SyncVar<int> _myInt = new();

// Each SyncType has a different constructor to take settings.
// Here is an example for SyncVars. This will demonstrate how to use
// the unreliable channel for SyncVars, and send the value upon any change.
// There are many different ways to create SyncTypeSettings; you can even
// make a const settings and initialize with that!
private readonly SyncVar<int> _myInt = new(new SyncTypeSettings(0f, Channel.Unreliable));
```

Settings can also be changed at runtime. This can be very useful to change behavior based on your game mechanics and needs, or to even slow down send rate as your player count grows.

```csharp
// This example shows in Awake but this code
// can be used literally anywhere.
private void Awake()
{
    // You can change all settings at once.
    _myInt.UpdateSettings(new SyncTypeSettings(....);

    // Or update only specific things, such as SendRate.
    // Change send rate to once per second.
    _myInt.UpdateSendRate(1f);
}
```

## Showing in the Inspector

SyncTypes can also be shown in the inspector.

You must first make sure your type is marked as serializable if a container; this is a Unity requirement.

```csharp
// SyncTypes can be virtually any data type. This example
// shows a container to demonstrate the serializable attribute.
[System.Serializable]
public struct MyType { }
```

Next the SyncType must not use the `readonly` indicator. We require the `readonly` indicator by default to emphasize you should not initialize your SyncType at runtime.

Below is an example of what **NOT** to do:

```csharp
private SyncVar<int> _myInt = new();

private void Awake()
{
    // This would result in errors at runtime.
    // Do not make a SyncType into a new instance
    _myInt = new();

    // Do not set a SyncType to another instance.
    _myInt = _someOtherDeclaredSyncVar;
}
```

The code above will actually prevent compilation in the editor as our code generators will detect you did not include the `readonly` indicator. To remove the `readonly` indicator you must also add the `[AllowMutableSyncType]` attribute above your SyncType.

```csharp
// This will work and show your SyncType in the inspector!
[AllowMutableSyncType]
[SerializeField] // Be sure to use the SerializeField attribute if not public.
private SyncVar<int> _myInt = new();
```
