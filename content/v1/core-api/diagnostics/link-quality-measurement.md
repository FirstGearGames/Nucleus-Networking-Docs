---
title: "Round-trip time, jitter and packet loss"
---

## The measured figures

`Connection.RoundTripTimeMilliseconds` is the link's typical round trip time, in milliseconds. It follows the link's usual condition, so a single slow reply does not swing it. `Connection.RoundTripTimeDeviationMilliseconds` is the link's jitter, how much individual round trips vary around that figure, and is meant to be read alongside it.

Both are `UnsetRoundTripTimeMilliseconds` / `UnsetRoundTripTimeDeviationMilliseconds` (`uint.MaxValue`) until the link has been measured. `Connection.IsRoundTripTimeUnset` is `true` exactly while `RoundTripTimeMilliseconds` equals `UnsetRoundTripTimeMilliseconds`. Zero is a valid reading, since a loopback link rounds to it, so check `IsRoundTripTimeUnset` rather than comparing the figure against zero.

Each peer measures its own view of the link: a client measures its link to the server and holds the figure on the server stand-in `Connection`; a server measures each remote client and holds the figure on that client's `Connection`. The figure can read slightly higher than the link's true round trip, and never lower.

## Packet loss

`Connection.PacketLossPercentage` is the share of recent probes that went unanswered, read the way a ping tool measures it. This is round-trip loss, not one-way.

The figure describes the link's recent condition rather than its whole history, so it falls back to 0% soon after loss stops. It reads 0% on a loopback link, which has no wire to lose on.

## The trust-the-client model

`Connection.ReportedRoundTripTimeMilliseconds` and `Connection.ReportedRoundTripTimeDeviationMilliseconds` are the raw figures the remote client stated for its own link - populated on a server's remote client `Connection`s, unset on a client. The server measures each client once, when it authenticates, and from then on its `RoundTripTimeMilliseconds` / `RoundTripTimeDeviationMilliseconds` for that client follow what the client reports.

A client that understates or fabricates its own round trip time or deviation only affects how well the server serves that one client. Nothing the server decides about any other peer depends on what one client reports. A server shows a client's reported packet loss as the client reported it, and nothing the server decides depends on that figure being honest.

## Withholding state until a link is measured

`Connection.CanReceiveState` is `!IsRoundTripTimeUnset`. A connection receives no state until its link has been measured.

A peer that receives nothing before then is expected, not broken. The wait is about one round trip; a host's own loopback link does not wait at all.

## How often the link is measured

`TransportManager.RoundTripTimeIntervalMilliseconds` sets how often a client measures its link to the server, in milliseconds, and defaults to 1000 (`TransportManager.DefaultRoundTripTimeIntervalMilliseconds`). Setting it to zero stops the repeated measurement. The first measurement of a link still happens, since a connection receives no state until it does.

## RoundTripTimeDiscovered

`TransportManager.RoundTripTimeDiscovered` fires once per `Connection`, the moment its link is measured for the first time - on the transition out of `Connection.UnsetRoundTripTimeMilliseconds`, or immediately for a host's own loopback link, which has no wire to measure.

The shipped Unity HUD ping row (`NetworkRoundTripTimeStatisticProvider`) subscribes to this event to adopt its server-stand-in `Connection` the moment it's known, rather than polling the transports on every refresh for a link that might by now be measured. It also seeds itself once on `Awake` by checking already-connected transports, since the event can't fire retroactively for a subscriber that didn't exist yet.

## Reading a wrong figure

None of these figures surfaces as an error when it is off; a wrong reading shows up as traffic instead. A round trip time or deviation that reads too low shows up as more repair traffic than the link needs. One that reads too high shows up as too little repair traffic and a slower recovery from loss than the link's real condition calls for.
