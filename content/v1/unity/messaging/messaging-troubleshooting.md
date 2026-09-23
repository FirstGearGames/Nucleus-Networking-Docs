---
title: "Messages and Calls That Do Not Arrive"
---

## The message hash could not be found for Type

`Connection.SendMessage<T0>` looks up the type's wire hash before anything else, and if no usable hash comes back it logs `The message hash could not be found for Type [...]` and returns. Nothing is queued.

The hash is worked out from the type's full name, so a sender never has to register a type before sending it. The lookup fails in only two cases:

- **Another message type this peer has already used hashes to the same value.** This is the usual cause. The first time it happens a separate error names both types (see the next section), and from then on every send of either type logs the error above.
- **The type has no full name to hash.** That logs `The FullName for [...] could not be found.` first. An ordinary concrete message type always has one.

This check runs before the host-loopback branch is even considered, so a host sending to its own other half is refused the same way as every other peer: loudly, and before anything is written.

The fix for a collision is renaming one of the two types, or moving it to another namespace, because the hash follows the full name. Registering a handler does not help: the same lookup refuses the handler too.

## Two types resolving to the same wire hash

`MessageManager` and `RpcManager` each remember which type first claimed each wire hash. If a second, different type produces the same hash, the registry does not pick a winner: it refuses both types, for sending, for registering a handler and for delivering a received body, for as long as they collide.

The alternative would be delivering the second type's body to the first type's handler, reading bytes as the wrong shape. The registry treats a collision as unresolvable and names both types when it happens, rather than let ambiguous data through.

## A call that reaches nobody

The receiver looks up the call's target system before any handler runs. If the receiver does not hold that system, the call is dropped with no log and no violation: an interest cull, a despawn, or a spawn whose priming full has not landed yet all look identical from here, and none of them are faults.

A routed call (`RpcRoute.TargetRelay`) has one more check once the system is found, still before any handler runs: the connection it names must be connected and must actually observe the addressed system. A target that has left or no longer observes it is refused the same way, silently.

So when a call goes nowhere, check interest before framing: does the receiver still hold the system, and does the intended recipient still observe it. A wire-level bug would produce a decode error or a violation. Silence is interest.

## Nothing happens on the sender

`RpcSelfDelivery` defaults to `None`, meaning the sender does not see its own call at all. A sender that expects immediate local feedback and gets nothing has not lost a call; it never asked to see it.

- `RpcSelfDelivery.Immediate` runs the sender's own handlers at the send site, before the call has gone anywhere. It runs even if the server later refuses the call.
- `RpcSelfDelivery.OnDelivery` runs the sender's handlers only once the call has actually been delivered (and not at all if refused). On the server's own send this behaves like `Immediate`, since the server is the delivery point.

If a sender's own handler never fires, check what `RpcSelfDelivery` the send asked for.

## A client's call refused

Three separate gates can refuse a client's call, in order:

1. **`RpcAccess`.** The server checks the sender against the system's `RpcAccess`. The sender must observe the system, and then `RpcSendAccess.AnyClient` admits any client while otherwise only the system's controller is admitted. The same check applies to a remote client's call and to a host's own client half calling its own server half. `CanLocalClientSendRpc` is a separate, earlier gate on the sending side: it lets a client queue a call upstream at all even when it is not the controller, and does not enter the server's admission check. If the system's access does not admit the sender, the receive is refused, and the server raises `RpcSendPermissionViolation` with the `SystemId` of the addressed system.
2. **A server handler returning `RpcRelayAction.Cancel`.** The server runs every registered handler and folds their answers: any single `Cancel` settles it, and no later `Relay` can overturn it. A handler that throws is treated as `Cancel` too: the throw counts as a refusal to relay, and the handler collection logs it, but the remaining handlers still receive the call.
3. **`MaximumInboundRpcsPerConnectionPerDrain`.** The server bounds how many calls one connection may deliver in a single drain (default 64). Once a connection exceeds it, `RpcFloodViolation` is raised (once per drain) with the received and allowed counts, and the rest of that drain's calls from that connection are dropped.

`RpcSendPermissionViolation` and `RpcFloodViolation` tell these two failure modes apart: a permission violation means the system's access rule rejected the sender; a flood violation means the sender delivered more calls in one drain than the bound admits.

## The real host symptom: not "fires twice"

The engine already prevents every double-fire shape a naive host implementation could produce. The actual symptom to watch for with a host is different: with `RpcSelfDelivery.Immediate` on an addressed send, the host's client half runs a copy of calls addressed to *other* players, not only the ones addressed to itself.

This falls out of what a host is: one peer running both the server and a client. A call routed to another connection is relayed by the server half; if that call was sent with `Immediate` self-delivery, the sender's own handlers already ran at the send site, on the same process the server is running on. The host's client half is not a separate machine, so it sees the immediate copy of every call its server half sends, not just the ones meant for it. Check the target of the call, not whether it "happened twice."

## A message type the receiver never registered

A receiver with no handler registered for a type is not an error. The message packet carries its own byte count, so a peer with no parser registered for that hash skips the packet's bytes and moves to the next one. No error, no log.

This is why a missing handler looks exactly like silence: the send succeeds, the packet arrives, and the receiver quietly steps over it. If a message type seems to vanish in transit, check that the receiving peer registered a handler for it. The sender needs no registration of its own.
