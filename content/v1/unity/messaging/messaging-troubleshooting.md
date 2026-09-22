---
title: "Messages and Calls That Do Not Arrive"
---

## The message hash could not be found for Type

`Connection.SendMessage<T0>` looks up the type's wire hash before anything else, and if the type was never registered it logs `The message hash could not be found for Type [...]` and returns. Nothing is queued.

This check runs before the host-loopback branch is even considered. A host's send to its own other half would otherwise skip straight to `MessageManager.DeliverLocalMessage` and never touch the registry at all, which would make a host the one peer where an unregistered message type went out silently. Raising the refusal first means every peer, host included, fails the same way: loudly, and before anything is written.

The fix is registering the message type on the sending peer. A type that is never sent from a peer never needs to be registered there.

## Two types resolving to the same wire hash

Both `MessageManager` and `RpcManager` hash their type registries through a `WireTypeHashRegistry`, which remembers which type each hash was first claimed by. If a second, different type produces the same hash, the registry does not pick a winner: it refuses to accept the collision.

The alternative would be delivering the second type's body to the first type's handler, reading bytes as the wrong shape. The registry treats a collision as unresolvable and names both types when it happens, rather than let ambiguous data through.

## A call that reaches nobody

`RpcManager.DispatchReceivedRpcPacket` resolves the call's target system with `SystemManager.TryGetSystem` before any handler runs. If the receiver does not hold that system, the call is dropped with no log and no violation: an interest cull, a despawn, or a spawn whose priming full has not landed yet all look identical from here, and none of them are faults.

Route admission is a separate step, ahead of that. A routed call (`RpcRoute.TargetRelay`) also has to resolve through `TryResolveRoutingTarget`, which requires the named connection to actually observe the addressed system (`NetworkSystem.IsObservedBy`); a target that no longer observes it is refused the same way, silently.

So when a call goes nowhere, check interest before framing: does the receiver still hold the system, and does the intended recipient still observe it. A wire-level bug would produce a decode error or a violation. Silence is interest.

## Nothing happens on the sender

`RpcSelfDelivery` defaults to `None`, meaning the sender does not see its own call at all. A sender that expects immediate local feedback and gets nothing has not lost a call; it never asked to see it.

- `RpcSelfDelivery.Immediate` runs the sender's own handlers at the send site, before the call has gone anywhere. It runs even if the authority later refuses the call.
- `RpcSelfDelivery.OnDelivery` runs the sender's handlers only once the call has actually been delivered (and not at all if refused). On the authority's own send this behaves like `Immediate`, since the authority is the delivery point.

If a sender's own handler never fires, check what `RpcSelfDelivery` the send asked for.

## A client's call refused

Three separate gates can refuse a client's call, in order:

1. **`RpcAccess` and `IsRpcSendPermitted`.** `NetworkSystem.IsRpcSendPermitted` checks the sender against `RpcAccess == RpcSendAccess.AnyClient` (or against being the system's controller) — the same check applies to a remote client's call and to a host's own client half calling its own authority. `CanLocalClientSendRpc` is a separate, earlier gate on the sending side: it lets a client queue a call upstream at all even when it is not the controller, and does not enter the authority's admission check. If the system's access does not admit the sender, the receive is refused. On the authority, a refusal in `DispatchReceivedRpcPacket` raises `RpcSendPermissionViolation` with the `SystemId` of the addressed system.
2. **An authority handler returning `RpcRelayAction.Cancel`.** `TypedRpcHandler<T0>.InvokeHandlers` runs every registered handler and folds their answers: any single `Cancel` settles it, and no later `Relay` can overturn it. A handler that throws is treated as `Cancel` too — the throw counts as a refusal to relay, and the handler collection logs it, but the remaining handlers still receive the call.
3. **`MaximumInboundRpcsPerConnectionPerDrain`.** `RpcManager.DeserializePackets` bounds how many calls one connection may deliver in a single drain (default 64). Once a connection exceeds it, `RpcFloodViolation` is raised (once per drain) with the received and allowed counts, and the rest of that drain's calls from that connection are dropped.

`RpcSendPermissionViolation` and `RpcFloodViolation` tell these two failure modes apart: a permission violation means the system's access rule rejected the sender; a flood violation means the sender delivered more calls in one drain than the bound admits.

## The real host symptom: not "fires twice"

The engine already prevents every double-fire shape a naive host implementation could produce. The actual symptom to watch for with a host is different: with `RpcSelfDelivery.Immediate` on an addressed send, the host's client half runs a copy of calls addressed to *other* players, not only the ones addressed to itself.

This falls out of what a host is: one peer running both the authority and a client. A call routed to another connection is relayed by the authority half; if that call was sent with `Immediate` self-delivery, the sender's own handlers already ran at the send site, on the same process the authority is running on. The host's client half is not a separate machine, so it sees the immediate copy of every call its authority half sends, not just the ones meant for it. Check the target of the call, not whether it "happened twice."

## A message type the receiver never registered

Unlike an unregistered type on the *sender*, an unregistered type on the *receiver* is not fatal. The message packet carries its own byte count, so a peer with no parser registered for that hash skips the packet's bytes and moves to the next one. No error, no log.

This is why a one-sided registration — a type registered on the sender but not the receiver — looks exactly like silence: the send succeeds, the packet arrives, and the receiver quietly steps over it. If a message type seems to vanish in transit, check that both peers registered it, not just the one that sent it.
