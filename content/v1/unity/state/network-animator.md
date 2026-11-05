---
title: "NetworkAnimator"
---

`NetworkAnimator` replicates an `Animator`. The controller's float, int, bool and trigger parameters, layer weights and playback speed are sent, and every other peer runs its own state machine from them.

Each layer's current state and phase are sent as well, as a correction. A peer whose state machine branched differently is pulled back onto the server's state, and a peer that starts watching the object, through a spawn, a late join, an interest change or a resync, opens every layer at the authority's current phase.

## Add it to an animated object

Add `NetworkAnimator` to the GameObject with the `Animator`. It requires a `NetworkSystemObject`.

| Field | Default | Effect |
|---|---|---|
| Animator | empty | The `Animator` to replicate. Empty uses the one on this GameObject. |
| State Correction Interval | `Disabled` | How often each layer's phase is refreshed between transitions. See [Choose a state correction interval](#choose-a-state-correction-interval). |
| Precise Playback Enabled | off | Followers play the authority's exact pose. See [Turn on precise playback to line up hitboxes](#turn-on-precise-playback-to-line-up-hitboxes). |
| Root Motion Management Enabled | on | Clears `Animator.applyRootMotion` on every peer that does not drive the object, so root motion cannot fight the replicated pose, and restores it on the peer that does. Turn it off when other code owns the flag, or when the object does not replicate a transform. |

## Choose a state correction interval

**State Correction Interval** (`StateCorrectionInterval`) bounds how far a follower already in the session can drift from the authority's phase during a long loop. A follower whose state machine took a different branch is corrected on the tick it happens, whatever this is set to.

- `Disabled` (default): the phase updates only on a transition, so a follower in a long loop runs on its own clock until the next one. Costs nothing.
- `Always`: refreshed every tick, so a follower's phase tracks the server's exactly. The most expensive.
- `Short`: refreshed at most every 250 ms.
- `Long`: refreshed at most once a second, for a loop a joiner only needs to open roughly in the right place.

`Short` and `Long` mean the same spans as the `SendInterval` values of the same names. Every value works in a Free build.

## Turn on precise playback to line up hitboxes

Turn on **Precise Playback Enabled** for an animated part whose pose must match the authority's, such as a limb carrying hitboxes that a lag-compensated shot is judged against. A follower then stops running its own state machine and places each layer at the authority's playback position, including through transitions. The pose is applied at once, so a raycast in the same frame sees it.

- It costs bandwidth for every layer on every tick, and more during a transition. A state that does not loop is held at its end, so a finished clip stops being sent.
- Animation events do not fire on a follower. Fire game logic from replicated state or a remote call instead.

## Drive the animator through NetworkAnimator

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

- Every write does nothing on a peer that does not drive the object, so the same script can run on every peer.
- `Speed` is `Animator.speed`, the whole animator's playback rate, not a parameter named "Speed".
- `Play` and `CrossFade` drive the controller's animator. Followers are moved onto the destination state at the server's phase rather than blending into it, so only the controller plays the fade.
- Only the first 64 bool parameters replicate. An animator with more logs an error with the count; move the extra bools to int parameters or a second animator.

## Fire triggers only through SetTrigger

Never call `Animator.SetTrigger` directly on a replicated animator: Unity can consume the trigger before it is sent. `NetworkAnimator.SetTrigger` fires the local animator and replicates the fire. `ResetTrigger` clears the trigger locally and also takes back a fire not yet sent this tick; a reset on a later tick is local only.

A peer that joins after triggers fired does not replay them. Its animator starts clean.

## React to a parameter landing

To run code when a replicated parameter or layer state changes on an observing peer, use `OnMembersChanged` on the replicated component, `UnityAnimatorComponent`, instead of polling the `Animator`. Its members are `FloatParameters`, `IntParameters`, `BoolParameters`, `TriggerPulses`, `LayerWeights`, `Speed`, `LayerStateHashes` and `LayerNormalizedTimes`, plus `LayerPlaybackPositions`, `LayerNextStateHashes`, `LayerNextPlaybackPositions` and `LayerTransitionProgress`, which stay empty unless Precise Playback is on.
