---
title: "Messages and Calls That Do Not Arrive"
---

## The message hash could not be found for Type

`Connection.SendMessage<T0>` logs `The message hash could not be found for Type [...]` and returns without queuing anything when it cannot get a usable wire hash for the type. A type never needs registering before it is sent. The lookup fails in only two cases:

- **Another message type this peer has already used hashes to the same value.** This is the usual cause. The first time, a separate error names both types (see the next section). After that, every send of either type logs the error above.
- **The type has no full name.** That logs `The FullName for [...] could not be found.` first. An ordinary concrete message type always has one.

A host sending to its own other half is refused the same way.

To fix a collision, rename one of the two types or move it to another namespace. Registering a handler does not help, because the same lookup refuses the handler too.

## Two types that share a wire hash are both refused

If two different message types, or two different call types, collide, neither can be sent or handled until you rename one of them.

## A call for a system the receiver lacks is dropped silently

If the receiver does not hold the call's target system, the call is dropped with no log and no violation. An interest cull, a despawn and a spawn that has not arrived yet all look the same here.

A routed call (`RpcRoute.TargetRelay`) is also dropped silently if the connection it names has left or no longer observes the addressed system.

So when a call goes nowhere, check interest first: does the receiver still hold the system, and does the intended recipient still observe it? A data bug would produce a read error or a violation.

## Nothing happens on the sender

`RpcSelfDelivery` defaults to `None`: the sender does not see its own call.

- `RpcSelfDelivery.Immediate` runs the sender's own handlers at the send site, before the call goes anywhere, even if the server later refuses it.
- `RpcSelfDelivery.OnDelivery` runs them only once the call is delivered, and not at all if it is refused. On the server's own send it behaves like `Immediate`.

## Three gates can refuse a client's call

The server checks these in order:

1. **`RpcAccess`.** The sender must observe the system. Then `RpcSendAccess.AnyClient` admits any client, and otherwise only the system's controller is admitted. This applies to a host's own client half too. If the sender is not admitted, the server raises `RpcSendPermissionViolation` with the addressed `SystemId`. `CanLocalClientSendRpc` is a separate check on the sending side that lets a client queue a call at all when it is not the controller; it does not change the server's check.
2. **A server handler returning `RpcRelayAction.Cancel`.** The server runs every registered handler, and any single `Cancel` settles it. A handler that throws counts as `Cancel` and is logged, and the remaining handlers still receive the call.
3. **`MaximumInboundRpcsPerConnectionPerDrain`** (default 64). Past this many calls from one connection in one drain, the server raises `RpcFloodViolation` once for that drain, with the received and allowed counts, and drops the rest of that drain's calls from the connection.

## A host runs calls addressed to other players

A host never fires a call twice. What it does do: with `RpcSelfDelivery.Immediate` on an addressed send, the host's client half runs a copy of calls addressed to other players, not only those addressed to itself, because the sender's handlers run on the same process as the server that relays the call. Check the call's target, not whether it "happened twice".

## A receiver with no handler skips the payload

A receiver with no handler for a message type skips that message silently. The sender needs no registration. If a message type seems to vanish, check that the receiving peer registered a handler for it.

