---
title: "What the server trusts"
---

## Observation gates everything

Every access check the engine makes, for a state write or for a remote call, starts with the same test: is the sending connection an observer of the system being addressed. That test runs first, before the access value and before whether the sender controls the object. A connection that does not observe a system is rejected outright, regardless of `StateWriteAccess` or `RpcSendAccess`.

This means a client cannot reach a system by guessing its id. An identifier that names something the client was never told about, or has since lost interest in, resolves to nothing on the server. Access - `Controller` or `AnyClient` - only decides what an observer may do once it has cleared this gate. It never substitutes for being told about the object in the first place.

The controller is checked next: a system's controller may always write to it or call it, under any access. An observer that is not the controller is admitted only when the access in force is `AnyClient`.

## Nothing travels as a grant

The server tells each observer two things about a system: the access value in force, and a one-bit hint of whether that observer personally may act. Neither is a permission a client can spend on its own. The server re-checks every incoming write and every incoming call against its own copy of the access, on every packet, so a client that forges or replays a favorable-looking declaration gains nothing - the check that matters runs on the receiving side, not the sending side.

The capability hint exists only so a well-behaved client avoids sending something the server is going to refuse anyway. A client that ignores the hint and sends regardless is met with the same enforcement as one that never saw it.

## Who actually sent it

An identifier a client places in a payload is a claim about itself, nothing more. What a handler is handed as the sender is the `Connection` the transport resolved for that packet - `RpcContext.SenderConnection` for a call, the equivalent resolved connection for a state write. That resolution happens below any code the client controls, so there is no field a client can set to speak as someone else.

For a call the server relays on to other observers, the relayed copy still carries the original sender's connection id, so attribution survives the hop; a client that receives a relayed call is being told who actually said it, not who forwarded it.

## Connections are not players

A `Connection`'s `RemoteAddress` is where it connected from, observed by the server rather than asserted by the client, which is what makes it usable as part of an identity check - but it names a location, not a player, since multiple clients behind the same NAT share one address.

A `Connection.Id` is assigned per session and reused once a connection is gone; nothing about it survives a disconnect. Anything that needs to recognize the same player across a reconnect keys on `Connection.Identity` instead - the value an authenticator stamps in on approval, meant to persist across sessions. Correlating a returning `Identity` with what it previously owned is game code's job; the engine holds no player-to-object mapping of its own.

## Arbitration is not a security boundary

`StateWriteAccess.AnyClient` (Pro) lets every observer, not just the controller, write a system's state. A Free build has no `StateWriteAccess` at all: only a system's controller may write its state, so there is never a contested write to arbitrate.

Contested multi-writer arbitration - resolving which of several observers' simultaneous writes to a system wins - is a Pro feature. Where it exists, the resolution is not adversarially safe: it is arbitrary but stable, and a client that keeps reconnecting to change its own connection id can farm a favorable outcome under it. Arbitration decides whose write is shown when two are equally legitimate; it does not decide whether a write should have been allowed, and it is not a defense against a client trying to win by gaming the mechanism. Anything where that matters needs its own arbiter in game code, sitting on top of the access check, not the arbitration itself.

## What Nucleus does not do

Nucleus does not encrypt transport traffic, does not run a server-side rewind, and provides no lag-compensated queries or hitbox history. None of that is built in; each is a client-observable, server-trusted primitive, and adding history, rewind, or encryption on top is game code's responsibility.

If you need to protect the bytes themselves - encryption, compression, obfuscation, or a custom integrity check - the one seam for it is the packet-transform layer, `TransportManager.PacketTransform` (Pro-only): it rewrites every packet's payload on its way to and from the transport, on both peers, before anything else in the engine sees it. That layer is not otherwise documented on this page.

## Enforcement only happens on the server

Every check above - observation, controller status, access, arbitration - runs on the server's copy of the system. A client build can run the same code and reach the same verdict locally for prediction or UI purposes, but that verdict changes nothing on the wire. A kick decided by a client, or a write a client's own code declines to send, is not enforcement; the server never asked for that answer and does not use it. The only check that matters is the one the server performs when the packet arrives.
