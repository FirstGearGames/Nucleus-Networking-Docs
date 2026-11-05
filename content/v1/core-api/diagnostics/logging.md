---
title: "Logging"
---

> **Using Unity?** See [Engine logging in the Unity console](../../unity/diagnostics/logging-in-unity.md).

A plain .NET host logs to the console through a `ConsoleLogger` from the start. A service has nothing reading its console, so replace the logger there.

## Replace the logger before creating the CoreManager

1. Implement `ILogger` (see below).
2. Pass it to `LoggingService.UseLogger` before `new CoreManager()`. The constructor already logs, so lines raised before the swap go to the old logger.

```csharp
LoggingService.UseLogger(new MyServiceLogger());
CoreManager coreManager = new();
```

`UseLogger` sets `LoggingService.Logger` and re-reads the logging level. Call it again to apply a level change in your own logger. You can set the logger and CodeBoost's application state in either order.

`LoggingService.LoggerSet` fires with the new `ILogger` whenever the logger changes:

```csharp
LoggingService.LoggerSet += logger => Console.WriteLine($"Logger swapped to {logger.GetType().Name}");
```

## Implement ILogger

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

- `LogInformation`, `LogWarning` and `LogError` receive the formatted message. Route each to your host's logging framework.
- `GetLoggerSetting` returns the `LoggerLevel` your logger runs at in each environment.
- `DisableUnconditionalDevelopmentStacktrace` returns `true` when your logger already captures its own stack traces, so the engine does not attach one in development environments.

## Set the level for each environment

`LoggerLevel` is `Error`, `Warning`, `Information` (least to most verbose) or `Disabled`, which turns logging off. `LoggerSetting` holds one level per environment:

| Field | Applies to |
|---|---|
| `Editor` | Running inside the editor |
| `DevelopmentBuilds` | Development builds outside the editor |
| `ReleaseBuilds` | Release builds |

`ConsoleLogger` runs `Information` in the editor and development builds, and `Error` in release. In a plain .NET process, CodeBoost's default application state (`IdeApplicationState`) always reports the editor, in Debug and Release builds alike. A .NET host therefore logs at `Information` by default, even in a Release build. To log less, register a logger whose `GetLoggerSetting` returns a lower `Editor` level.

Check the level before formatting a message, so the string is never built when the level is off:

```csharp
if (LoggingService.IsInformationEnabled)
    LoggingService.LogInformation($"Tick {tick}: {expensiveDescription()}");
```

`LoggingService` also has `IsWarningEnabled` and `IsErrorEnabled`.

### Choosing the level at runtime

When the level is decided at runtime, such as a warning the first time and an error once it keeps happening, pass it to `Logger.Log` and check it with `Logger.IsEnabled`:

```csharp
LoggerLevel loggerLevel = desyncCount > 10 ? LoggerLevel.Error : LoggerLevel.Warning;

if (Logger.IsEnabled(loggerLevel))
    Logger.Log(typeof(MatchService), loggerLevel, $"Player {playerName} desynced {desyncCount} times.");
```

`IsEnabled` is always false for `LoggerLevel.Disabled`, and `Log` with `Disabled` writes nothing, so `Disabled` also means "decided not to log".

When the decision and the write happen in different places, carry the line as a `LogEntry`, a level and a message together. `LogEntry.Information`, `LogEntry.Warning` and `LogEntry.Error` build one. The default `LogEntry` is unset (`IsSet` is false) and logs nothing. [Violations](./violations.md) use this so a handler can change or clear a line.

```csharp
LogEntry logEntry = isLobbyFull ? LogEntry.Warning("Lobby is full; the join was refused.") : default;

// Later, wherever the line is written. An unset entry writes nothing.
Logger<MatchService>.Log(logEntry);
```

A `LogEntry` built from a constant string allocates nothing, which matters on a path that runs per packet.
