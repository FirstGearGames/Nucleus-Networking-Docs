Provides an efficient way to synchronize a stopwatch between server and clients.

Like SyncTimer, SyncStopwatch only updates state changes such as start or stopping, rather than each individual delta change.

```csharp
private readonly SyncStopwatch _timePassed = new();
```

Making changes to the stopwatch is very simple, and like other SyncTypes must be done on the server.

```csharp
// All of the actions below are automatically synchronized.

/* Starts the stopwatch while optionally sending a stop
 * message first if stopwatch was already running.
 * If the stopwatch was previously running the time passed
 * would be reset.
 *
 * This would invoke callbacks indicating a stopwatch
 * had stopped, then started again. */
_timePassed.StartStopwatch(true);

/* Pauses the stopwatch and optionally sends the current
 * timer value as it is on the server. */
_timePassed.PauseStopwatch(false);

// Unpauses the current stopwatch.
_timePassed.UnpauseStopwatch();

/* Ends the stopwatch while optionally sending the
 * current value to clients, as it was during the stop. */
_timePassed.StopStopwatch(false);
```

Updating and reading the stopwatch value is much like you would a normal float value.

```csharp
private void Update()
{
    /* Like SyncTimer, SyncStopwatch must be updated
     * with a delta on both server and client. Do not
     * update the delta twice if clientHost. You can update
     * the delta anywhere in your code. */
    _timePassed.Update(Time.deltaTime);

    // Access the current time passed.
    Debug.Log(_timePassed.Elapsed);

    /* You may also see if the stopwatch is paused before
     * accessing elapsed. */
    if (!_timePassed.Paused)
        Debug.Log(_timePassed.Elapsed);
}
```

Like other SyncTypes, you can subscribe to change events for the SyncStopwatch.

```csharp
private void Awake()
{
    _timePassed.OnChange += _timePassed_OnChange;
}

private void OnDestroy()
{
    _timePassed.OnChange -= _timePassed_OnChange;
}

private void _timePassed_OnChange(SyncStopwatchOperation op, float prev, bool asServer)
{
    /* Like all SyncType callbacks, asServer is true if the callback
     * is occurring on the server side, false if on the client side. */

    // Here is an example of performing logic only if starting or stopping.
    if (op == SyncStopwatchOperation.Start || op == SyncStopwatchOperation.Stop)
    {
        // Do logic.
    }

    /* prev, our float, indicates the value of the stopwatch prior to
     * the operation. Remember that you can get the current value using
     * _timePassed.Elapsed */
}
```
