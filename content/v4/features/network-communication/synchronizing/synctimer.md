Provides an efficient way to synchronize a timer between server and clients.

Unlike SyncVars, a SyncTimer only updates state changes such as start or stopping, rather than each individual delta change.

SyncTimer is a Custom SyncType, and is declared like any other SyncType.

```csharp
private readonly SyncTimer _timeRemaining = new SyncTimer();
```

Making changes to the timer is very simple, and like other SyncTypes must be done on the server.

```csharp
// All of the actions below are automatically synchronized.

/* Starts the timer with 5 seconds on it.
 *
 * The optional boolean argument will also send
 * a stop event before starting a new timer, only if
 * the previous timer is still running.
 *
 * EG: if a timer was started with 5 seconds and
 * you start a new timer with 2 seconds remaining
 * a StopTimer will be sent with the remaining time
 * of 2 seconds before the timer is started again at
 * 5 seconds. */
_timeRemaining.StartTimer(5f, true);

/* Pauses the timer and optionally sends the current
 * timer value as it is on the server. */
_timeRemaining.PauseTimer(false);

// Unpauses the current timer.
_timeRemaining.UnpauseTimer();

/* Stops the timer early and optionally sends the
 * current timer value as it is on the server. */
_timeRemaining.StopTimer(false);
```

Updating and reading the timer value is much like you would a normal float value.

```csharp
private void Update()
{
    /* Timers must be updated both on the server
     * and clients. This only needs
     * to be done on either/or if clientHost. The timer
     * may be updated in any method. */
    _timeRemaining.Update();

    /* Access the current time remaining. This is how
     * you can utilize the current timer value. When a timer
     * is complete the remaining value will be 0f. */
    Debug.Log(_timeRemaining.Remaining);

    /* You may also see if the timer is paused before
     * accessing time remaining. */
    if (!_timeRemaining.Paused)
        Debug.Log(_timeRemaining.Remaining);
}
```

Like other SyncTypes, you can subscribe to change events for the SyncTimer.

```csharp
private void Awake()
{
    _timeRemaining.OnChange += _timeRemaining_OnChange;
}

private void OnDestroy()
{
    _timeRemaining.OnChange -= _timeRemaining_OnChange;
}

private void _timeRemaining_OnChange(SyncTimerOperation op, float prev, float next, bool asServer)
{
    /* Like all SyncType callbacks, asServer is true if the callback
     * is occurring on the server side, false if on the client side. */

    // Timer has been started with initial values.
    if (op == SyncTimerOperation.Start)
        Debug.Log($"The timer was started with {next} seconds.");

    // Timer has been paused.
    else if (op == SyncTimerOperation.Pause)
        Debug.Log($"The timer was paused.");

    // Timer has been paused and latest server values were sent.
    else if (op == SyncTimerOperation.PauseUpdated)
        Debug.Log($"The timer was paused and remaining time has been updated to {next} seconds.");

    // Timer was unpaused.
    else if (op == SyncTimerOperation.Unpause)
        Debug.Log($"The timer was unpaused.");

    // Timer has been manually stopped.
    else if (op == SyncTimerOperation.Stop)
        Debug.Log($"The timer has been stopped and is no longer running.");

    /* Timer has been manually stopped.
     *
     * When StopUpdated is called, Previous will contain the remaining time
     * prior to being stopped as it is locally. Next will contain the remaining
     * time prior to being stopped as it was on the server. These values
     * often align but the information is provided for your potential needs.
     *
     * When the server starts a new timer while one is already active, and chooses
     * to also send a stop update using the StartTimer(float,bool) option, a
     * StopUpdated is also sent to know previous timer values before starting a new timer. */
    else if (op == SyncTimerOperation.StopUpdated)
        Debug.Log($"The timer was stopped at value {next}, previous value was {prev}.");

    // A timer has reached 0f.
    else if (op == SyncTimerOperation.Finished)
        Debug.Log($"The timer has completed!");

    // Complete occurs after all change events are processed.
    else if (op == SyncTimerOperation.Complete)
        Debug.Log("All timer callbacks have completed for this tick.");
}
```
