Is an easy way to keep a HashSet collection automatically synchronized over the network.

Callbacks for SyncHashSet are similar to SyncList. And like other synchronization types, changes are set immediately before the callback occurs.

```csharp
private readonly SyncHashSet<int> _myCollection = new SyncHashSet<int>();

private void Awake()
{
    _myCollection.OnChange += _myCollection_OnChange;
}

private void FixedUpdate()
{
    // You can modify a SyncHashSet as you would any other HashSet.
    _myCollection.Add(Time.frameCount);
}

/* Like SyncVars the callback offers an asServer option
 * to indicate if the callback is occurring on the server
 * or the client. As SyncVars do, changes have already been
 * made to the collection before the callback occurs. */
private void _myCollection_OnChange(SyncHashSetOperation op, int item, bool asServer)
{
    switch (op)
    {
        /* An object was added to the HashSet. Item is
         * the added object. */
        case SyncHashSetOperation.Add:
            break;

        /* An object has been removed from the HashSet. Item
         * is the removed object. */
        case SyncHashSetOperation.Remove:
            break;

        /* The HashSet has been cleared.
         * Item will be default. */
        case SyncHashSetOperation.Clear:
            break;

        /* An entry in the HashSet has been updated.
         * When this occurs the item is removed
         * and added. Item will be the new value.
         * Item will likely need a custom comparer
         * for this to function properly. */
        case SyncHashSetOperation.Update:
            break;

        /* When Complete calls, all changes have been
         * made to the collection. You may use this
         * to refresh information in relation to
         * the changes, rather than doing so
         * after every entry change. All values are
         * default for this operation. */
        case SyncHashSetOperation.Complete:
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

private readonly SyncHashSet<MyContainer> _containers = new();
private MyContainer _containerReference = new();

private void Awake()
{
    _containerReference.Level = 5;
    _containers.Add(_containerReference);
}

[Server]
private void ModifyPlayer()
{
    // This will change the value locally but it will not synchronize to clients.
    _containerReference.Level = 10;

    // The value must be set dirty to force a synchronization.
    _containers.Dirty(_containerReference);
}
```
