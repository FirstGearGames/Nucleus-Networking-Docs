---
title: "Understanding ReplicateState"
---
Being familiar with what each state means will help you fine-tune your gameplay on spectated objects.

> If you need a refresher on what each state means see our API or simply navigate to the `ReplicateState` enum in your code editor.

Each state is a flag value; a replicate state may contain multiple flags. There are numerous extensions you may use to check if a state contains certain values.

> You can view all built-in state extensions within the `ReplicateState` file.

## Invalid

An invalid `ReplicateState` should never occur. This would imply internally Fish-Networking failed to properly set the state.

## Ticked

Server and clients use this flag. This flag will be set if the data tick has run outside a reconcile, such as from user code within `OnTick`. Ticked can exist during a replay/reconcile, but only if the data had first run outside the replay/reconcile.

## Replayed

Only clients will use this flag. The replayed flag is set if data is being run during a reconcile.

> The server is always considered right and never has to correct data, so it never reconciles or replays inputs.

## Created

Server and client use this flag. A created flag indicates that the data was created by controller, such as owner or the server if no owner. The created flag will not be present if the controller has not sent updates, such as if they are not taking any action.

## State examples

Below are examples of some possible states and what they mean.

```csharp
// You will see this value if the data is being replayed, it previously ran outside the
// reconcile, and data is created by controller.
state = (ReplicateState.Replayed | ReplicateState.Ticked | ReplicateState.Created);

// When the state is only Replayed then the data is not Created, and the tick on data
// has not occurred outside the reconcile yet. This is what we often refer to as a
// future state.
state = ReplicateState.Replayed;

// When a state is Ticked only it indicates that the data is being run outside a
// reconcile, and that the controller has not sent data for this particular tick.
state = ReplicateState.Ticked;
```

> For more possible flag examples see the state extensions (the `ReplicateState` file).
