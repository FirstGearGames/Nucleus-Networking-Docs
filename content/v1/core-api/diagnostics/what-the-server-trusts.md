---
title: "What the server trusts"
---

## Observation gates everything

Every member write and every remote call is first checked for whether the sending connection observes the system. A connection that does not observe it is rejected, whatever `MemberWriteAccess` or `RpcSendAccess` says, so a client cannot reach a system by guessing its id.

Next, the system's controller may always write to it or call it. Any other observer is admitted only when the access in force is `AnyClient`.

## Access values are hints, not grants

The server re-checks every incoming write and call against its own copy of the access. What a client is told about access only saves an honest client from sending something the server would refuse. Forging or ignoring it gains nothing.

## The sender is the connection, not the payload

An id a client writes into a payload is only a claim. The sender a handler is given is the `Connection` the transport resolved for that packet, such as `RpcContext.SenderConnection` for a call. A call the server relays to other observers still names its original sender, and a call arriving from a client is always attributed to that client, so a client cannot pose as another client.

## Connections are not players

`Connection.RemoteAddress` is observed by the server, so it can be part of an identity check, but several clients behind one NAT share an address.

`Connection.Id` is assigned per session and reused once a connection is gone. To recognize a player across reconnects, key on `Connection.Identity`, which your authenticator sets on approval. Matching a returning `Identity` to what it owned before is up to your game.

## Arbitration is not a security boundary

In Pro, `MemberWriteAccess.AnyClient` lets every observer set a system's members, and arbitration picks which of several simultaneous writes wins. The pick is arbitrary but stable, and a client that keeps reconnecting to change its connection id can farm a favorable result. Arbitration does not decide whether a write should have been allowed. Where winning matters, put your own arbiter in game code on top of the access check.

A Free build has no `MemberWriteAccess`. Only the controller may set a system's members, so there is nothing to arbitrate.

## Nucleus does not encrypt traffic

To encrypt, compress, obfuscate or integrity-check packets, use the Pro packet transform, `TransportManager.PacketTransform`. See [Packet transforms](../transports/packet-transforms.md).

## A shooter's view is bounded, not trusted

Lag compensation (Pro) judges a shot against the moment the client says its screen was showing. A view older than `MaximumRewindMilliseconds`, or newer than anything the server has recorded, is clamped into range, still judged, and raises `LagCompensationViewClampedViolation` (ignored by default). Within the window a client can name any moment, so the window is the limit on how far a shooter is favored.

The ray is the client's claim too. Clip it at walls on the server against the present-time scene. The queries test it only against hitboxes from the server's own history. See [The rewind window and the view clamp](../lag-compensation/the-rewind-window.md).

## Enforcement only happens on the server

Every check above runs on the server's copy of the system. A client can run the same check for prediction or UI, but a verdict reached on a client, such as a kick or a write it declines to send, enforces nothing.
