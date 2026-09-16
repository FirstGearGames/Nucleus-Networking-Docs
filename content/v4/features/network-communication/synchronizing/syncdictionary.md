Is an easy way to keep a Dictionary collection automatically synchronized over the network.

SyncDictionary supports all the functionality a normal dictionary would, just as SyncList supports List abilities.

Callbacks for SyncDictionary are similar to SyncList. And like other synchronization types, changes are set immediately before the callback occurs.

```csharp
private readonly SyncDictionary<NetworkConnection, string> _playerNames = new();

private void Awake()
{
    _playerNames.OnChange += _playerNames_OnChange;
}

// SyncDictionaries also include the asServer parameter.
private void _playerNames_OnChange(SyncDictionaryOperation op, NetworkConnection key, string value, bool asServer)
{
    /* Key will be provided for
     * Add, Remove, and Set. */
    switch (op)
    {
        // Adds key with value.
        case SyncDictionaryOperation.Add:
            break;

        // Removes key.
        case SyncDictionaryOperation.Remove:
            break;

        // Sets key to a new value.
        case SyncDictionaryOperation.Set:
            break;

        // Clears the dictionary.
        case SyncDictionaryOperation.Clear:
            break;

        // Like SyncList, indicates all operations are complete.
        case SyncDictionaryOperation.Complete:
            break;
    }
}
```

> **Warning:** If you are using this SyncType with a container, such as a class or structure, and want to modify values within that container, you must set the value dirty. See the example below.

```csharp
[System.Serializable]
private struct MyContainer
{
    public string PlayerName;
    public int Level;
}

private readonly SyncDictionary<int, MyContainer> _containers = new();

private void Awake()
{
    MyContainer mc = new MyContainer { Level = 5 };
    _containers[2] = mc;
}

[Server]
private void ModifyContainer()
{
    MyContainer mc = _containers[2];

    // This will change the value locally but it will not synchronize to clients.
    mc.Level = 10;

    // You may re-apply the value to the dictionary.
    _containers[2] = mc;

    // Or set dirty on the value or key. Using the key is often more performant.
    _containers.Dirty(2);
}
```
