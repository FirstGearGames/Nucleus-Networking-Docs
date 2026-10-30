---
title: "NetworkAnimator"
---

## NetworkAnimator replicates parameters, not animation state

`NetworkAnimator` replicates a GameObject's `Animator` across peers. Parameters are the primary channel: the peer driving the object reads its float, int, bool and trigger parameters, its layer weights and its playback speed, and every other peer applies those values and lets its own `Animator` run its own state machine from them.

The layer state (each layer's current state hash and normalized time) rides on top as a correction, not as the primary replication path. It costs nothing between transitions, because a hash only changes when a layer transitions. It serves two purposes: a peer whose state machine branched differently from the controller is pulled back onto the server's state, and a peer that joins mid-session opens each layer on the reported state instead of at the controller's entry state.

The phase a joiner opens on is the live one. Whether a peer starts watching the object through a spawn, a late join, an interest change or a resync, it opens every layer at the phase the authority's animator holds at that moment, so a joiner opens a looping idle where the authority is now, not where the authority entered the state.

When parameters alone are not close enough, for example an animated part that lag-compensated hitboxes are judged against, turn on [Precise Playback](#precise-playback-enabled) and followers play the authority's exact pose instead.

Add `NetworkAnimator` to the same GameObject as the `Animator` it should replicate; it requires a `NetworkSystemObject`.

## Animator field

```csharp
[SerializeField]
private Animator _animator;
```

The `Animator` to replicate. Left empty in the inspector, the component falls back to the `Animator` on its own GameObject at `Awake`.

The values actually captured and applied live on `UnityAnimatorComponent`, the replicated component `NetworkAnimator` binds to through its `NetworkSystem`: `FloatParameters`, `IntParameters`, `BoolParameters` (up to 64), `TriggerPulses`, `LayerWeights`, `Speed`, `LayerStateHashes` and `LayerNormalizedTimes`, plus `LayerPlaybackPositions`, `LayerNextStateHashes`, `LayerNextPlaybackPositions` and `LayerTransitionProgress`, which stay empty and cost nothing unless Precise Playback is on. `NetworkAnimator` is the MonoBehaviour surface over that component; it doesn't hold the replicated data itself.

An animator with more than 64 bool parameters replicates the first 64 and drops the rest. `NetworkAnimator` logs an error naming the count when it binds, so split the extra bools into int parameters or a second animator if they need to reach other peers.

## State Correction Interval

```csharp
public enum StateCorrectionInterval : byte
{
    Disabled,
    Always,
    Short,
    Long
}
```

Controls how often the replicated normalized time of each layer is refreshed while no layer is transitioning, which bounds how far a follower already in the session can drift from the authority's phase during a long loop. The state hash costs nothing between transitions since it doesn't change, but the phase advances every tick a clip plays, so refreshing it on a cadence means a character idling in a loop pays for that idle forever.

- **Disabled** (default): the phase only updates on a transition. A joiner still opens on the live phase, because the statement it joins on carries it; after that, a follower in a long loop runs on its own animator's clock until the next transition.
- **Always** — refreshed every tick. The most expensive tier; a follower's phase tracks the server's exactly rather than merely opening near it.
- **Short** — refreshed at most every 250ms.
- **Long** — refreshed at most once a second, for a loop a joiner only needs to open roughly in the right place.

`Short` and `Long` mirror the same-named `SendInterval` tiers and resolve through the same `SendIntervalTicks.Resolve`, so a span read on this field means the same thing it means on a send interval. Correction of a peer whose state machine took a different branch doesn't depend on this setting at all: the state hash carries that on the tick the divergence happens either way; this setting only bounds how far a follower's phase can drift between transitions.

Unlike a paced send interval, none of this is a Pro feature. It's a local decision about how often to re-read an animator, so every tier here paces in a free build.

## Precise Playback Enabled

```csharp
[SerializeField]
private bool _precisePlaybackEnabled;
```

Off by default. With it on, the authority captures every layer's playback position each tick, and during a transition also the next state, its position and how far the blend has progressed. A follower stops running its own state machine: it holds its animator still and places each layer at the authority's position, interpolated between the two newest ticks it applied, cross-fading at the replicated progress. The pose is evaluated at once, so a raycast in the same frame sees it.

Use it for an animated part whose pose has to match the authority's, such as a limb carrying hitboxes that a lag-compensated shot is judged against.

It costs bandwidth for every layer on every tick, and more during a transition, where parameters alone cost nothing between changes. A state that does not loop is held at its end, so a finished or static clip stops being sent. Animation events do not fire on a follower in this mode, because its clips are placed rather than played through; fire game logic from replicated state or a remote call instead.

## Root Motion Management Enabled

```csharp
[SerializeField]
private bool _rootMotionManagementEnabled = true;
```

When enabled (the default), `Animator.applyRootMotion` is cleared on every peer that doesn't drive the object, so root motion can't fight the replicated pose, and restored on the peer that does drive it. Disable it when other code owns the flag, or when the object doesn't replicate a transform.

## The public members

All writing methods are silently no-ops on a peer that doesn't drive the object — the same script runs on every peer, and a call that has effect on the controller is inert everywhere else.

```csharp
public float Speed { get; set; }

public void SetFloat(string parameterName, float value);
public void SetFloat(int parameterHash, float value);

public void SetInteger(string parameterName, int value);
public void SetInteger(int parameterHash, int value);

public void SetBool(string parameterName, bool isParameterTrue);
public void SetBool(int parameterHash, bool isParameterTrue);

public void SetLayerWeight(int layerIndex, float weight);

public void SetTrigger(string parameterName);
public void SetTrigger(int parameterHash);

public void ResetTrigger(string parameterName);
public void ResetTrigger(int parameterHash);

public void Play(int stateNameHash, int layerIndex = 0, float normalizedTime = 0f);
public void CrossFade(int stateNameHash, float normalizedTransitionDuration, int layerIndex = 0);
```

`Speed` maps to `Animator.speed`, the whole animator's playback rate, distinct from any parameter a controller happens to name "Speed". `Play` and `CrossFade` drive the local animator on the controller; the resulting state reaches every other peer through the replicated layer state, not through the fade itself — a follower is corrected onto the destination state at the server's reported phase rather than told to blend into it, so the fade `CrossFade` would have played is the server's alone.

## Triggers must go through SetTrigger

Never call `Animator.SetTrigger` directly on the replicated animator. Unity consumes a trigger inside the state machine, so a trigger set directly can be raised and consumed between two ticks and be gone before anything here could observe it to replicate the fire.

`NetworkAnimator.SetTrigger` fires the local animator and raises the replicated trigger count in the same call, which is why it must be the only way a trigger is fired on this object. `ResetTrigger` clears it locally and, if the fire hasn't been serialized yet this tick, takes back the count too; a reset arriving on a later tick is local only, since the fire has already gone out to observers.

## Late joiners don't replay history

A trigger fires as a rising count rather than a one-shot event, so a receiver applies the difference between what it last applied and what it just received. The first counts a joining peer receives establish its baseline instead of being treated as fires to play — a peer that joins after ten triggers have already fired sees its animator start clean, not fire all ten at once.

## Reacting to a parameter landing

To run code when a replicated parameter or layer state changes on an observing peer, hook into the change-callback path on the replicated component (`OnMembersChanged`) rather than polling the `Animator` every frame.
