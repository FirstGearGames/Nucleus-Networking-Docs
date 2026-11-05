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

## Only the server validates

`ValidateMemberWrite` runs only on the server, and never for the server's own writes.

## A declined value is never relayed

Nothing else the client sent is undone. The declined value is not sent to other observers.

The client that wrote it keeps showing its own value for the convergence window (see [Letting clients set members](./state-write-access.md)), then shows the server's value again. This costs no traffic.

Declining is not a violation and does not count against the client. Use violations only for something a client should never have been able to send.

## The first write wins

When two clients write the same member on the same tick, the first write applied wins, with or without a validator. Writes are applied in ascending `Connection.Id` order, so the lowest permitted `Connection.Id` wins.

`Connection.Id` is stable for the life of a connection but is not chosen for fairness and is not a security boundary. A client that reconnects gets a new `Id`, so it can reconnect into a better position. For anything that must survive a reconnect or resist that, arbitrate on `Connection.Identity`, which names a client across reconnects.

## See which client's write landed

Call `TryGetWritingClient(out Connection connection)` on the member from `NetworkComponent.OnMembersChanged` under `MemberChangeDirection.Read`. See [NetworkMember](./network-member.md).
