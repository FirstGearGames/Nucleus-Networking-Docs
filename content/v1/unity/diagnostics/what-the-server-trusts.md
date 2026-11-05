---
title: "What the server trusts"
---

Every check on this page runs on the server's copy of the system. A client can reach the same verdict locally for prediction or UI, but a kick it decides or a write it declines to send is not enforcement.

## Observation gates everything

Before any access check, the server asks whether the sending connection observes the system being addressed. A connection that does not is rejected, whatever the `MemberWriteAccess` or `RpcSendAccess`. A client therefore cannot reach a system by guessing its id: an id it was never told about, or has lost interest in, resolves to nothing.

Next, the system's controller may always set its members and call it, under any access. Any other observer is admitted only when the access is `AnyClient`.

## Nothing travels as a grant

The server re-checks every incoming write and call against its own copy of the access, on every packet. The access value and the hint the server sends each observer only let an honest client avoid sends the server would refuse. A client that forges them or ignores them gains nothing.

## The sender is the connection the transport resolved

An id a client puts in a payload is only a claim. A handler is given the `Connection` the transport resolved for the packet (`RpcContext.SenderConnection` for a call, and the same resolved connection for a member write), and the client cannot change it.

A call the server relays to other observers still carries the original sender's connection id. Only the server writes that id: a call arriving from a client is attributed to that client whatever originator id its packet names, so a client cannot pose as another client to a handler, to the relay's sender exclusion, or to `RpcContext.SenderConnection`.

## Connections are not players

- `Connection.RemoteAddress` is where the connection came from, observed by the server, so it can be part of an identity check. It names a location, not a player: clients behind the same NAT share one address.
- `Connection.Id` is assigned per session and reused once a connection is gone.
- To recognize a player across a reconnect, key on `Connection.Identity`, the value your authenticator sets on approval. Matching a returning `Identity` to what it owned before is up to your game code.

## Arbitration is not a security boundary

`MemberWriteAccess.AnyClient` (Pro) lets every observer set a system's members. A Free build has no `MemberWriteAccess`, so only the controller sets members and nothing needs arbitrating.

In Pro, when several observers write to a system at once, arbitration picks a winner that is arbitrary but stable. A client that keeps reconnecting to change its connection id can farm a favorable outcome. Arbitration only chooses between equally legitimate writes; it does not decide whether a write should be allowed. Where winning matters, put your own arbiter in game code on top of the access check.

## Nucleus does not encrypt traffic

To encrypt, compress, obfuscate or add an integrity check to the bytes themselves, use the packet-transform layer, `TransportManager.PacketTransform` (Pro). It rewrites every packet's payload on both peers before anything else in the engine sees it.

## A shooter's view is bounded, not trusted

Lag compensation (Pro) judges a shot against the moment the client says its screen was showing. A claimed view older than `MaximumRewindMilliseconds`, or newer than anything the server recorded, is clamped into range, still judged, and raises `LagCompensationViewClampedViolation` (ignored by default). Within the window a client can name any moment, so the window is the limit on how far a shooter is favored.

The ray is also the client's claim. Clip it at walls on the server against the present-time scene. The queries test it only against the hitboxes in the server's own history, never against anything the client reports about a target. See [UnityLagCompensationManager](../lag-compensation/unity-lag-compensation-manager.md#the-view-clamp-violation).
