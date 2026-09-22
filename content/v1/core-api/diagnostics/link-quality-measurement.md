---
title: "Round-trip time, jitter and packet loss"
---

## The measured figures

`Connection.RoundTripTimeMilliseconds` is a smoothed estimate of the link's round trip time, in milliseconds. It follows the same estimator RFC 6298 §2.2/§2.3 define for TCP's retransmission timer: the first sample seeds the average outright, and each later sample moves it by an eighth, so one slow reply nudges the figure rather than redefining it. `Connection.RoundTripTimeDeviationMilliseconds` carries the spread the smoothing hides - the link's jitter - and is meant to be read alongside it.

Both are `UnsetRoundTripTimeMilliseconds` / `UnsetRoundTripTimeDeviationMilliseconds` (`uint.MaxValue`) until the link has a first sample. `Connection.IsRoundTripTimeUnset` is `true` exactly while `RoundTripTimeMilliseconds` equals `UnsetRoundTripTimeMilliseconds`. `uint.MaxValue` is used instead of zero because zero is a valid measurement - a loopback link genuinely rounds to it - so it can't also mean "unmeasured" without the two being indistinguishable.

Each peer measures its own view of the link: a client measures its link to the server and holds the figure on the server stand-in `Connection`; a server measures each remote client and holds the figure on that client's `Connection`. The figure carries a small positive bias and never under-reports, since a reply is only read when the receiving peer's loop next polls its transport.

## Packet loss

`Connection.PacketLossPercentage` is the share of recent probes that went unanswered, read the way a ping tool measures it: from gaps in the echoed probe sequence. Every probe's reply carries the probe's sequence number, so a sequence that never comes back is a probe that did not round trip. This is round-trip loss, not one-way.

Because it counts sequence gaps rather than timing replies, a reply does not have to land inside the probe interval to count. A late or reordered reply still closes its gap and is not counted as lost, even if a newer probe has already gone out by the time it arrives. The figure is measured over the last 16 probes, so it tracks the link's current condition rather than its whole history and clears within about that many probe intervals once loss stops. It reads 0% on a loopback link, which has no wire to lose on.

## The trust-the-client model

`Connection.ReportedRoundTripTimeMilliseconds` and `Connection.ReportedRoundTripTimeDeviationMilliseconds` are the raw figures the remote client stated for its own link - populated on a server's remote client `Connection`s, unset on a client. They sit beside `RoundTripTimeMilliseconds` / `RoundTripTimeDeviationMilliseconds`, which the server also adopts these reported values into after its one-time bootstrap probe at authentication. From that point the server never probes the client again; it keeps the figure current from what the client reports on each of its own probes.

This is a deliberate trust boundary. A client that understates or fabricates its own round trip time or deviation only mishandles its own recovery patience - the server judges that client's own acknowledgments too harshly or too leniently based on the figure the client handed it. It cannot reach past its own stream: nothing the server decides about any other peer depends on what one client reports. Packet loss follows the same footing - a server presents a client's reported loss without measuring it itself, and nothing the server decides depends on that figure being honest.

## Withholding state until a link is measured

`Connection.CanReceiveState` is `!IsRoundTripTimeUnset`. State is withheld from a connection until its link has been measured, because every timing decision the sender makes about a peer - chiefly how long to wait for an acknowledgment before serving recovery - is denominated in that measurement. Serving state first would mean judging a peer's first acknowledgments against a round trip time that doesn't exist yet, and recovering a peer that was never late.

An unmeasured peer is therefore silent by design, not broken. The wait is one round trip on the link's first, reliably-sent probe; a host's loopback link resolves without any wire round trip at all.

## The probe machinery

`RoundTripTimePing` and `RoundTripTimePong` are the two messages that measure a link. Both carry timestamp-free incrementing sequences: `RoundTripTimePing.Sequence` identifies the probe, its `RoundTripTimePong` reply echoes that same sequence, and only the peer that sent the probe ever measures elapsed time - the two peers need no shared clock. A `RoundTripTimePing` also carries the sender's own last-measured `ReportedRoundTripTimeMilliseconds`, `ReportedRoundTripTimeDeviationMilliseconds`, and `ReportedPacketLossPercentage` for the peer to adopt.

Both sides probe: a client probes its server link on a cadence, and a server sends exactly one probe to each client, at authentication, then trusts what that client reports thereafter. `TransportManager.RoundTripTimeIntervalMilliseconds` sets that cadence, in milliseconds, and defaults to 1000 (`TransportManager.DefaultRoundTripTimeIntervalMilliseconds`). Setting it to zero stops the recurring probe; it does not affect the mandatory first probe of a link, since state is withheld until that first probe resolves.

## RoundTripTimeDiscovered

`TransportManager.RoundTripTimeDiscovered` fires once per `Connection`, the moment its link is measured for the first time - on the transition out of `Connection.UnsetRoundTripTimeMilliseconds`, or immediately for a host's own loopback link, which has no wire to measure.

The shipped Unity HUD ping row (`NetworkRoundTripTimeStatisticProvider`) subscribes to this event to adopt its server-stand-in `Connection` the moment it's known, rather than polling the transports on every refresh for a link that might by now be measured. It also seeds itself once on `Awake` by checking already-connected transports, since the event can't fire retroactively for a subscriber that didn't exist yet.

## Reading a wrong figure

None of these figures surface as a visible fault when they're off - they feed recovery patience, so a wrong reading shows up as traffic, not an error. A round trip time or deviation read too low makes the receiving side judge acknowledgments too harshly and serve recovery that wasn't needed, showing up as too much repair traffic. Read too high, a genuinely late peer waits too long before it gets served recovery at all, showing up as too little repair traffic and a slower recovery than the link's real condition would call for.
