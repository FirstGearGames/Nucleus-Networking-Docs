---
title: "Round-trip time, jitter and packet loss"
---

## Read the round trip time and jitter

- `Connection.RoundTripTimeMilliseconds` is the link's typical round trip time. A single slow reply does not swing it. It can read slightly higher than the true round trip, never lower.
- `Connection.RoundTripTimeDeviationMilliseconds` is the link's jitter: how much individual round trips vary around that figure.

Both read `UnsetRoundTripTimeMilliseconds` / `UnsetRoundTripTimeDeviationMilliseconds` (`uint.MaxValue`) until the link is measured. Zero is a valid reading on a loopback link, so check `Connection.IsRoundTripTimeUnset` rather than comparing against zero.

Each peer measures its own view of the link. A client holds the figure on its server stand-in `Connection`. A server holds it on each remote client's `Connection`.

## Read packet loss

`Connection.PacketLossPercentage` is the share of recent probes that went unanswered, measured the way a ping tool does. It is round-trip loss, not one-way. It describes recent loss, so it falls back to 0% soon after loss stops. It reads 0% on a loopback link.

## The server follows what each client reports

`Connection.ReportedRoundTripTimeMilliseconds` and `Connection.ReportedRoundTripTimeDeviationMilliseconds` are the figures a remote client stated for its own link. They are set on a server's remote client `Connection`s and unset on a client. The server measures each client once, when it authenticates, and from then on follows what the client reports.

A client that understates or fakes these figures only affects how well the server serves that one client. A server shows a client's reported packet loss as reported, and nothing the server decides depends on it.

## A connection receives no state until its link is measured

`Connection.CanReceiveState` is `!IsRoundTripTimeUnset`. A peer receiving nothing before then is expected. The wait is about one round trip. A host's own loopback link does not wait.

## Set how often the link is measured

`TransportManager.RoundTripTimeIntervalMilliseconds` sets how often a client measures its link to the server. It defaults to 1000 (`TransportManager.DefaultRoundTripTimeIntervalMilliseconds`). Zero stops repeated measurement, but the first measurement still happens.

## Know when a link is first measured

`TransportManager.RoundTripTimeDiscovered` fires once per `Connection`, when its link is first measured, or immediately for a host's own loopback link. It does not fire for links measured before you subscribed, so also check connections that already exist when you subscribe.

## A wrong figure shows up as traffic, not an error

A round trip time or deviation that reads too low shows up as more repair traffic than the link needs. One that reads too high shows up as too little repair traffic and slower recovery from loss.
