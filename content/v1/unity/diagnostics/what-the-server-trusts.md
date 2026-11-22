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
- `Connection.Id` is assigned per session and reused once a connection is gone. Every client is told every other client's `Connection.Id`, so never use one as a secret, such as a password or a join code.
- To recognize a player across a reconnect, key on `Connection.Identity`, the value your authenticator sets on approval. Matching a returning `Identity` to what it owned before is up to your game code.

## Arbitration is not a security boundary

`MemberWriteAccess.AnyClient` lets every observer set a system's members. In Free each such write is a request, so the client only ever sees the result the server sends back.

When several observers write to a system at once, in either edition, arbitration picks a winner that is arbitrary but stable. A client that keeps reconnecting to change its connection id can farm a favorable outcome. Arbitration only chooses between equally legitimate writes; it does not decide whether a write should be allowed. Where winning matters, put your own arbiter in game code on top of the access check.

## A controller's movement is taken as sent

`NetworkTransform` and `NetworkRigidbody` take the position their controlling client sends, so a modified client can put its object anywhere. When movement must be fair, use a validated behaviour such as `ValidatedTransform`, `ValidatedCharacterController` or `ValidatedRigidbody`, whose results the server works out for itself, or check the movement on the server. See [Predicting a body with a validated behaviour](../physics/predicting-a-body-with-a-validated-behaviour.md).

## A client can read everything it is sent

A modified client can read every value the server sends it, whether or not your game shows it, such as the position of an enemy behind a wall. To keep something from a client, never send it:

- Cull the object for that client with an interest rule on **Spawn**, such as **Controller Only** on a [Network Interest Object](../interest/network-interest-object-component.md) for an object only its controller may see. Stopping the object is not enough, because it stays on the client with the last values it was sent. See [Frozen or gone: what a stop does to the object](../interest/stopping-objects-in-unity.md).
- Keep a value only the server needs off the network with `[ReplicationIgnore]`. See [Keeping a member off the network](../../core-api/state/member-value-types.md#keep-a-member-off-the-wire-with-replicationignore).

## Synapse does not encrypt traffic

Anyone on the network path can read what the Synapse Transport sends. [Securing a server](../../core-api/diagnostics/securing-a-server.md#anyone-on-the-network-path-can-read-synapse-traffic) lists the transports that encrypt and how to add your own encryption.

## A shooter's view is bounded, not trusted

Lag compensation (Pro) judges a shot against the moment the client says its screen was showing. A claimed view older than `MaximumRewindMilliseconds`, or newer than anything the server recorded, is clamped into range, still judged, and raises `LagCompensationViewClampedViolation` (ignored by default). Within the window a client can name any moment, so the window is the limit on how far a shooter is favored.

The ray is also the client's claim. Clip it at walls on the server against the present-time scene, and refuse an origin far from where the server has the shooter; see [Firing and judging a shot](../lag-compensation/firing-and-judging-a-shot.md#judge-on-the-server). The queries test the ray only against the hitboxes in the server's own history, never against anything the client reports about a target. See [UnityLagCompensationManager](../lag-compensation/unity-lag-compensation-manager.md#the-view-clamp-violation).
