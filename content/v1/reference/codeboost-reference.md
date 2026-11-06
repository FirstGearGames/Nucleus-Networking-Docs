---
title: "CodeBoost reference"
---

CodeBoost is a separate library, published under its own terms, that ships beside Nucleus (in the Unity package too) and provides logging, pooling and some low-allocation types. It is not part of the Nucleus API, but you are free to use it directly.

## Replace the logger with LoggingService.UseLogger

`LoggingService.Logger` holds the active `ILogger`. It starts as a `ConsoleLogger`, so a plain .NET host gets console output with no setup. To replace it:

```csharp
LoggingService.UseLogger(new MyServiceLogger());
```

`ILogger` declares `GetLoggerSetting()`, `DisableUnconditionalDevelopmentStacktrace()`, `LogInformation`, `LogWarning` and `LogError`.

- `LoggerSetting` holds three `LoggerLevel` values, `Editor`, `DevelopmentBuilds` and `ReleaseBuilds`, each one of `Disabled`, `Error`, `Warning` or `Information`. `LoggingService` uses the one for the current environment.
- Check `LoggingService.IsInformationEnabled`, `IsWarningEnabled` or `IsErrorEnabled` before formatting an interpolated log argument, so the string is not built when the level would drop it.
- For a level chosen at runtime, use `Logger.IsEnabled(LoggerLevel)` and `Logger.Log`, which takes the level as an argument. A `LogEntry` carries a level and a message together, so a line can be decided in one place and written in another. See [Logging](../core-api/diagnostics/logging.md#choosing-the-level-at-runtime).
- `DisableUnconditionalDevelopmentStacktrace()` decides whether a development build adds a stack trace to every log call. `ConsoleLogger` returns `false`, so a development build traces its information and warning logs too. Errors always carry one.

## Rent objects from the pools

- `ObjectPool<T0>` (constraint `new()`) rents and returns plain objects.
- `ResettableObjectPool<T0>` does the same for a type implementing `IPoolResettable`, calling `OnRent()` after renting and `OnReturn()` before storing it.
- `ListPool<T0>`, `HashSetPool<T0>`, `DictionaryPool<T0, T1>` and `QueuePool<T0>` pool the built-in collections.
- `Utf8EncodingPool` pools `UTF8Encoding` instances.

Each pool has `Rent()`, `Return(T0)` and `ReturnAndNullifyReference(ref T0)`.

```csharp
List<int> list = ListPool<int>.Rent();
try
{
    // use list
}
finally
{
    ListPool<int>.Return(list);
}
```

## Know the types Nucleus passes you

- `RingBuffer<T0>`: a fixed-size collection that overwrites its oldest entries once full.
- `BoostedQueue<T0>`: a queue used in place of `Queue<T0>` where Unity 2022's code generation cannot compile a `Queue<T0>` reference.
- `RentedArray<T0>`: an `IDisposable` wrapper around an `ArrayPool<T0>` rental; disposing it returns the array.
- `RoundRobinCursor<T0>`: walks a read-only list in wrap-around batches sized to sweep the whole list once over a configured time window.
- `Vector2Int`, `Vector3Int32`, `Vector3Int64`, `Vector4Int`: integer vectors.
- `QuaternionInt16`, `QuaternionInt32`: integer-component quaternions.
- `UnifiedColor`: an RGBA color stored as four bytes, with float accessors.

## Mark pooled members so the build checks their reset

- `[PoolResettableMember]` marks a field or property that must be reset in `IPoolResettable.OnReturn()` and initialized in `OnRent()`.
- `[PoolResettableMethod]` marks a method that does that work for one or more such members outside `OnRent` and `OnReturn`.
- `[PoolDisposableMember]` marks a member that must be disposed rather than reset.

An analyzer in `CodeBoost.CodeAnalysis.Analyzers` fails the build when an `IPoolResettable` type leaves a `[PoolResettableMember]` out of its reset.

## Check the environment and use the math helpers

The static `ApplicationState` class, an `IApplicationState`, answers `IsEditor()`, `IsDevelopment()`, `IsGuiBuild()`, `IsHeadlessBuild()`, `IsPlaying()` and `IsQuitting()`. `LoggingService` uses it to pick a `LoggerLevel`.

`MathCb`, in `CodeBoost.Mathematics`, holds floating-point and vector helper methods. `RoundingType` (`Down`, `Up`, `UpNonZero`, `ToEven`, `AwayFromZero`) selects the rounding rule for the integer divide extension methods.
