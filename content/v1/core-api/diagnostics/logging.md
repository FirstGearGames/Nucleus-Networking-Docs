---
title: "Logging"
---

> **Using Unity?** See [Engine logging in the Unity console](../../unity/diagnostics/logging-in-unity.md).

## The default logger

A plain .NET host gets a `ConsoleLogger` automatically. `LoggingService` registers one in its static constructor, so `Console.WriteLine` output starts flowing before you write any setup code. That's fine when the engine runs behind a terminal. It's wrong for a service: nothing there reads stdout, so every log line is lost.

## Swapping the logger

`LoggingService.UseLogger(ILogger)` is the one call that replaces the active logger. It sets the public `LoggingService.Logger` field and re-reads the current logging level, so a fresh sink starts filtering correctly from that point on.

```csharp
LoggingService.UseLogger(new MyServiceLogger());
```

Code that needs to react when the logger changes can subscribe to `LoggingService.LoggerSet`, which fires with the newly registered `ILogger` instance.

```csharp
LoggingService.LoggerSet += logger => Console.WriteLine($"Logger swapped to {logger.GetType().Name}");
```

## Implementing ILogger

```csharp
public interface ILogger
{
    LoggerSetting GetLoggerSetting();
    bool DisableUnconditionalDevelopmentStacktrace();
    void LogInformation(string message);
    void LogWarning(string message);
    void LogError(string message);
}
```

`LogInformation`, `LogWarning`, and `LogError` receive the formatted message string; route each to your host's own logging framework.

`GetLoggerSetting` declares which `LoggerLevel` your logger runs at in each environment (see below). `LoggingService` calls it whenever it needs to re-cache the active level.

`DisableUnconditionalDevelopmentStacktrace` returns `true` when your sink already captures its own stack traces, so the engine doesn't need to attach one unconditionally in development environments.

## Levels and cost

`LoggerLevel` is `Error`, `Warning`, `Information`, or `Disabled`. `Error`, `Warning`, and `Information` run least to most verbose; `Disabled` turns logging off entirely rather than sitting at either end of that scale. `LoggerSetting` exposes it as three independent knobs:

| Field | Applies to |
|---|---|
| `Editor` | Running inside the editor |
| `DevelopmentBuilds` | Development builds outside the editor |
| `ReleaseBuilds` | Release builds |

`ConsoleLogger`'s setting runs `Information` in the editor and development, `Error` in release. Which of the three applies comes from CodeBoost's application state, and in a plain .NET process the default one, `IdeApplicationState`, always reports that it is running in the editor, in Debug and Release builds alike. A .NET host therefore logs at `Information` by default, even in a Release build. To log less, register a logger whose `GetLoggerSetting` returns a lower `Editor` level.

Checking a level before formatting a message avoids the cost of building a string nobody will read. `LoggingService` exposes `IsInformationEnabled`, `IsWarningEnabled`, and `IsErrorEnabled` for this:

```csharp
if (LoggingService.IsInformationEnabled)
    LoggingService.LogInformation($"Tick {tick}: {expensiveDescription()}");
```

When a level is disabled, the guarded branch never runs, so the interpolated string is never built.

### Choosing the level at runtime

Sometimes the level is not known until the code runs: a warning the first time, an error once it keeps happening. `Logger.Log` takes the level as an argument, and `Logger.IsEnabled` answers the same question as the three checks above for a level held in a variable:

```csharp
LoggerLevel loggerLevel = desyncCount > 10 ? LoggerLevel.Error : LoggerLevel.Warning;

if (Logger.IsEnabled(loggerLevel))
    Logger.Log(typeof(MatchService), loggerLevel, $"Player {playerName} desynced {desyncCount} times.");
```

`IsEnabled` is always false for `LoggerLevel.Disabled`, and `Log` with `Disabled` writes nothing, so `Disabled` doubles as "decided not to log".

When the decision and the write happen in different places, carry the line as a `LogEntry`: a level and a message together. `LogEntry.Information`, `LogEntry.Warning` and `LogEntry.Error` build one, and the default `LogEntry` is unset (`IsSet` is false) and logs nothing. The engine uses this for violations, where a handler can change or clear the line a raise site seeded (see [Violations](./violations.md)):

```csharp
LogEntry logEntry = isLobbyFull ? LogEntry.Warning("Lobby is full; the join was refused.") : default;

// Later, wherever the line is written. An unset entry writes nothing.
Logger<MatchService>.Log(logEntry);
```

Pass a constant message to a `LogEntry` where you can: an entry built from a constant string allocates nothing, which matters on a path that runs per packet.

## Set this before new CoreManager()

Swap the logger before you construct the `CoreManager`. The constructor already logs (a clamped tick rate, for one), and with the default provider the loop starts stepping the moment the constructor returns, so anything raised during bring-up goes to the old sink if you swap afterward. The level is re-read inside `UseLogger`, and again whenever CodeBoost's application state is set, so a host may register its logger and its application state in either order and still log at the level the environment calls for. Calling `UseLogger` again is what makes a level change in your own logger take effect.

```csharp
LoggingService.UseLogger(new MyServiceLogger());
CoreManager coreManager = new();
// The constructor, AddTransportAsync and everything after this line log through MyServiceLogger.
```
