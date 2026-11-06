---
title: "Messages and Calls That Do Not Arrive"
---

## The message hash could not be found for Type

`Connection.SendMessage<T0>` logs `The message hash could not be found for Type [...]` and sends nothing. A host sending to its own other half is refused the same way. There are two causes:

- **Another message type this peer already used has the same hash.** This is the usual cause; see the next section.
- **The type has no full name.** `The FullName for [...] could not be found.` is logged first. An ordinary concrete message type always has one.

## Two types resolve to the same hash

A message or call type is identified by a hash of its full name, so no type needs registering before it is sent. If two different message types, or two different call types, produce the same hash, the first use of the second one logs an error naming both. From then on both types are refused for sending, for registering a handler and for receiving, and every send of either logs the error above.

To fix it, rename one of the two types or move it to another namespace. Registering a handler does not help. A message type can never collide with a call type.

## A call reaches nobody

The receiver drops a call silently when it does not hold the addressed system: an interest cull, a despawn and a spawn that has not landed yet all look the same. A client's `RpcTarget.To` call is also dropped silently when the named connection has left or no longer observes the system.

So check interest first: does the receiver still hold the system, and does the recipient still observe it? A real fault shows up as a decode error or a violation.

## The sender never sees its own call

`RpcSelfDelivery` defaults to `None`, so the sender's own handlers do not run. Pass `Immediate` or `OnDelivery`; see [Seeing Your Own Call: RpcSelfDelivery](./rpc-self-delivery.md).

## A client's call is refused

On the client, `TrySendRpc` returns `false` without sending unless the client controls the system or `CanLocalClientSendRpc` is `true`. On the server, three checks can refuse the call, in this order:

1. **`RpcAccess`.** The sender must observe the system. `RpcSendAccess.AnyClient` then admits any client; otherwise only the controller is admitted. A host's own client half is held to the same rule. A refused call raises `RpcSendPermissionViolation` with the addressed system's `SystemId`.
2. **A handler returns `RpcRelayAction.Cancel`.** Any one `Cancel` stops the relay, and a handler that throws counts as `Cancel`. See [Judging and Refusing a Relayed Call](./rpc-relay-and-moderation.md).
3. **`MaximumInboundRpcsPerConnectionPerDrain`** (default 64). Calls past the cap are dropped and `RpcFloodViolation` is raised once per drain. See [Capping calls per drain](./rpc-send-access.md#capping-calls-per-drain).

## A host runs calls addressed to other players

With `RpcSelfDelivery.Immediate` on an `RpcTarget.To` send, the host runs its handlers for every addressed call, including calls meant for other players. Nothing fires twice; check who the call was for. See [Seeing Your Own Call: RpcSelfDelivery](./rpc-self-delivery.md).

## The receiver never registered a handler

A message type with no handler on the receiver is skipped without an error or log. Make sure the receiving peer registered a handler; the sender needs none. A call type with no handler is not decoded, but the server still relays it.
