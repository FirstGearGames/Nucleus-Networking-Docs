---
title: "Judging and arbitrating client writes"
---

## Decline a value with IMemberWriteValidator

Control, and in Pro `MemberWriteAccess`, decides whether a client may write a member at all. To judge the value itself, implement `IMemberWriteValidator<T0>` on the `NetworkComponent` that owns the member and return a `MemberWriteAction` from `ValidateMemberWrite`:

```csharp
public partial class SwitchBankComponent : NetworkComponent, IMemberWriteValidator<uint>
{
    private const uint SwitchCount = 3;

    public readonly NetworkMember<uint> ActiveSwitchIndex = new();

    public MemberWriteAction ValidateMemberWrite(NetworkMember<uint> networkMember, uint proposedValue, Connection writingClientConnection) =>
        proposedValue < SwitchCount ? MemberWriteAction.Accept : MemberWriteAction.Decline;
}
```

- `MemberWriteAction.Accept` (the zero value): the value lands as if there were no validator.
- `MemberWriteAction.Decline`: the member keeps the value it holds.

Inside the call, `networkMember.Value` is still the current value, so you can compare it with `proposedValue`.

## Implement it once per value type

Implement `IMemberWriteValidator<T0>` once for each member value type you want judged. A component with a `NetworkMember<uint>` and a `NetworkMember<bool>` implements it twice to judge both. A type you do not implement it for is not judged.

All members of one type share one implementation, so compare the member passed in against your own fields:

```csharp
if (ReferenceEquals(networkMember, ActiveSwitchIndex))
{
    // ...
}
```

## Assign a validator to judge a component you do not own

Every member asks the object in its `WriteValidator` field. When the member is bound to its component, the field is filled with that component if it implements the matching interface, which is all the example above does. You can assign any other object that implements the interface instead:

- Assign one to judge a member of a component you did not write, such as the position of a `NetworkTransform`.
- Assign `null` to stop judging the member.
- An assigned validator replaces the component's own. To judge with both, keep the old value and call it from yours.
- The field is cleared when the member returns to its pool, so assign it each time the server sets the object up.

This lets you judge writes to a component you do not own against your game's own state. The component stays as it is, and the rule lives in your code beside the state it reads, such as a speed boost, a stamina pool or the area a player stands in. The server holds that state, so a client cannot fake it.

For example, a `NetworkTransform` subclass can hand every position a client writes to the player's own script:

```csharp
public class PlayerTransform : NetworkTransform
{
    // Runs on every server setup, so the validator is assigned again when a pooled object is reused.
    protected override void OnServerStarted()
    {
        if (NetworkSystem.TryGetComponent(out UnityTransformComponentBase transformComponent))
            transformComponent.Position.WriteValidator = GetComponent<PlayerMovementRules>();
    }
}
```

`PlayerMovementRules` implements `IMemberWriteValidator<System.Numerics.Vector3>` and declines any step longer than the speed your server code allows the player right now, such as a faster speed while the server sees it on a speed pad. [Validating a client-authoritative NetworkTransform](../../unity/state/validating-client-transforms.md) builds it step by step, including putting the client back after a decline.

## Judge references and collections the same way

Reference and collection members have a `WriteValidator` field too, filled and assigned by the same rules.

- `NetworkSystemMember` and `NetworkConnectionMember` take an `IReferenceWriteValidator<NetworkSystem>` or an `IReferenceWriteValidator<Connection>`. Its `ValidateReferenceWrite(NetworkReferenceMember<T0> networkMember, T0 proposedTarget, uint proposedTargetId, Connection writingClientConnection)` receives the target the client named. `proposedTarget` is `null` when the client cleared the reference, which `proposedTargetId` shows as 0, or when it named something the server does not hold.
- A collection member takes an `ICollectionWriteValidator<T0, T1>`, where `T0` is the member type and `T1` the collection the proposed contents arrive in, for example `ICollectionWriteValidator<NetworkListMember<int>, List<int>>`, or `ArraySegment<T0>` for a `NetworkArrayMember<T0>`. Its `ValidateCollectionWrite(T0 networkMember, T1 proposedValues, Connection writingClientConnection)` is asked once per write with the whole proposed contents, while the member still holds its current contents. Read `proposedValues` during the call only, and do not change it. A decline refuses the whole write.

## Only the server validates

Every validator runs only on the server, only for a client's write, and never for the server's own writes. A validator that throws declines the write, and the exception is logged.

## A declined value is never relayed

Nothing else the client sent is undone. The declined value is not sent to other observers.

The server sends the client that wrote it the server's value, and the member on that client returns to it. A client writing a system it does not control first keeps showing its own value until the answer has had time to arrive (see [Letting clients set members](./state-write-access.md)).

Declining is not a violation and does not count against the client. Use violations only for something a client should never have been able to send.

## The first write wins

When two clients write the same member on the same tick, the first write applied wins, with or without a validator. Writes are applied in ascending `Connection.Id` order, so the lowest permitted `Connection.Id` wins.

`Connection.Id` is stable for the life of a connection but is not chosen for fairness and is not a security boundary. A client that reconnects gets a new `Id`, so it can reconnect into a better position. For anything that must survive a reconnect or resist that, arbitrate on `Connection.Identity`, which names a client across reconnects.

## See which client's write landed

Call `TryGetWritingClient(out Connection connection)` on the member from `NetworkComponent.OnMembersChanged` under `MemberChangeDirection.Read`. See [NetworkMember](./network-member.md).
