A simple guide on how to write a custom observer condition.

Sometimes you may have unique requirements for an observer condition. When this is the case you can easily create your own `ObserverCondition`. The code below comments on how to create your own condition.

```csharp
// The example below does not have many practical uses
// but it shows the bare minimum needed to create a custom condition.
// This condition makes an object only visible if the connection's
// ClientId matches the serialized value, _id.

// Make a new class which inherits from ObserverCondition.
// ObserverCondition is a ScriptableObject, so also create an asset
// menu to create a new ScriptableObject of your condition.
[CreateAssetMenu(menuName = "FishNet/Observers/ClientId Condition", fileName = "New ClientId Condition")]
public class ClientIdCondition : ObserverCondition
{
    /// <summary>
    /// ClientId a connection must be to pass the condition.
    /// </summary>
    [Tooltip("ClientId a connection must be to pass the condition.")]
    [SerializeField]
    private int _id = 0;

    private void Awake()
    {
        // Awake can optionally be used to initialize values based on serialized
        // data. The source file of DistanceCondition is a good example
        // of where Awake may be used.
    }

    /// <summary>
    /// Returns if the object which this condition resides should be visible to connection.
    /// </summary>
    /// <param name="connection">Connection which the condition is being checked for.</param>
    /// <param name="currentlyAdded">True if the connection currently has visibility of this object.</param>
    /// <param name="notProcessed">True if the condition was not processed. This can be used to skip processing for performance. While output as true this condition result assumes the previous ConditionMet value.</param>
    public override bool ConditionMet(NetworkConnection connection, bool currentlyAdded, out bool notProcessed)
    {
        notProcessed = false;

        // When true is returned it means the connection meets
        // the condition requirements. When false, the
        // connection does not and will not see the object.

        // Will return true if connection Id matches _id.
        return (connection.ClientId == _id);
    }

    /// <summary>
    /// Type of condition this is. Certain types are handled differently, such as Timed which are checked for changes at timed intervals.
    /// </summary>
    /* Since clientId does not change, a Normal condition type will work.
     * See API on ObserverConditionType for more information on what each
     * type does. */
    public override ObserverConditionType GetConditionType() => ObserverConditionType.Normal;
}
```

You can get an idea of the flexibility of a condition by exploring the source of other premade conditions.
