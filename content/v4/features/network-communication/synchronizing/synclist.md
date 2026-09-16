Is an easy way to keep a List collection automatically synchronized over the network.

Using a SyncList is done the same as with a normal List.

Network callbacks on SyncList do have a little more information than SyncVars. Other non-SyncVar SyncTypes also have their own unique callbacks. The example below demonstrates a SyncList callback.

```csharp
private readonly SyncList<int> _myCollection = new();

private void Awake()
{
    /* Listening to SyncList callbacks are a
     * little different from SyncVars. */
    _myCollection.OnChange += _myCollection_OnChange;
}

private void Update()
{
    // You can modify a SyncList as you would any other list.
    _myCollection.Add(10);
    _myCollection.RemoveAt(0);
    // etc.
}

/* Like SyncVars the callback offers an asServer option
 * to indicate if the callback is occurring on the server
 * or the client. As SyncVars do, changes have already been
 * made to the collection before the callback occurs. */
private void _myCollection_OnChange(SyncListOperation op, int index, int oldItem, int newItem, bool asServer)
{
    switch (op)
    {
        /* An object was added to the list. Index
         * will be where it was added, which will be the end
         * of the list, while newItem is the value added. */
        case SyncListOperation.Add:
            break;

        /* An object was removed from the list. Index
         * is from where the object was removed. oldItem
         * will contain the removed item. */
        case SyncListOperation.RemoveAt:
            break;

        /* An object was inserted into the list. Index
         * is where the object was inserted. newItem
         * contains the item inserted. */
        case SyncListOperation.Insert:
            break;

        /* An object replaced another. Index
         * is where the object was replaced. oldItem
         * is the item that was replaced, while
         * newItem is the item which now has its place. */
        case SyncListOperation.Set:
            break;

        /* All objects have been cleared. Index, oldValue,
         * and newValue are default. */
        case SyncListOperation.Clear:
            break;

        /* When Complete calls, all changes have been
         * made to the collection. You may use this
         * to refresh information in relation to
         * the list changes, rather than doing so
         * after every entry change. Like Clear,
         * Index, oldItem, and newItem are all default. */
        case SyncListOperation.Complete:
            break;
    }
}
```

> **Warning:** If you are using this SyncType with a container, such as a class, and want to modify values within that container, you must set the value dirty. See the example below.

```csharp
private class MyClass
{
    public string PlayerName;
    public int Level;
}

private readonly SyncList<MyClass> _players = new SyncList<MyClass>();

// Call dirty on an index after modifying an entry's field to force a synchronize.
[Server]
private void ModifyPlayer()
{
    _players[0].Level = 10;
    // Dirty the 0 index.
    _players.Dirty(0);
}
```

Structures cannot have their values modified when they reside within a collection. You must instead create a local variable for the collection index you wish to modify, change values on the local copy, then set the local copy back into the collection.

```csharp
[System.Serializable]
private struct MyStruct
{
    public string PlayerName;
    public int Level;
}

private readonly SyncList<MyStruct> _players = new();

[Server]
private void ModifyPlayer()
{
    MyStruct ms = _players[0];
    ms.Level = 10;
    _players[0] = ms;
}
```
