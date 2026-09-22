---
title: "CodeBoost reference"
---

CodeBoost is a separate library that ships beside Nucleus and that the engine compiles against for logging, pooling and a handful of low-allocation types. It is public as its own submodule under its own terms, not part of the Nucleus API surface, and yours to use directly. CodeBoost.dll ships inside the Unity package too, so a Unity project reaching for its pooling or logging is exactly as supported as a plain .NET host.

## Logging

`ILogger` is the swap point. It declares `GetLoggerSetting()`, `DisableUnconditionalDevelopmentStacktrace()`, and `LogInformation`/`LogWarning`/`LogError`. `LoggingService` holds the active instance in its static `Logger` field and starts with a `ConsoleLogger` already registered, so a plain .NET host gets console output with no setup. Call `LoggingService.UseLogger(ILogger)` to replace it.

```csharp
LoggingService.UseLogger(new MyServiceLogger());
```

`LoggerSetting` carries three `LoggerLevel` values — `Editor`, `DevelopmentBuilds`, `ReleaseBuilds` — each one of `Disabled`, `Error`, `Warning`, or `Information`. `LoggingService` reads whichever applies to the current environment and caches it. Check `LoggingService.IsInformationEnabled` / `IsWarningEnabled` / `IsErrorEnabled` before formatting an interpolated log argument, so the string isn't built when the level would drop it anyway.

`DisableUnconditionalDevelopmentStacktrace()` on `ILogger` controls whether a development build appends a stack trace to every log call regardless of level; `ConsoleLogger` returns `true`, so its info/warning logs stay plain.

## Pooling

`ObjectPool<T0>` (constraint `new()`) rents and returns plain objects through a thread-local stack backed by a shared global stack. `ResettableObjectPool<T0>` does the same for a type implementing `IPoolResettable`, calling `OnRent()` after renting and `OnReturn()` before storing the instance back. Both expose `Rent()`, `Return(T0)`, and `ReturnAndNullifyReference(ref T0)`.

The collection pools follow the same shape for built-in collections: `ListPool<T0>`, `HashSetPool<T0>`, `DictionaryPool<T0, T1>`, `QueuePool<T0>`. `Utf8EncodingPool` pools `UTF8Encoding` instances the same way, without a resettable contract since the type has no mutable state to reset.

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

## Types worth knowing

Several Nucleus signatures pass these CodeBoost types directly:

- `RingBuffer<T0>` — a fixed-size collection that overwrites its oldest entries once full.
- `BoostedQueue<T0>` — a queue-shaped collection used in place of `Queue<T0>` where Unity 2022's codegen can't compile a `Queue<T0>` reference.
- `RentedArray<T0>` — an `IDisposable` wrapper around an `ArrayPool<T0>` rental; disposing it returns the array.
- `RoundRobinCursor<T0>` — walks a read-only list in wrap-around batches sized to sweep the whole list once over a configured time window.
- `Vector2Int`, `Vector3Int32`, `Vector3Int64`, `Vector4Int` — integer vectors.
- `QuaternionInt16`, `QuaternionInt32` — integer-component quaternions.
- `UnifiedColor` — an RGBA color stored as four bytes, with float accessors.

## Build-time pool-reset checking

`[PoolResettableMember]` marks a field or property that must be reset on `IPoolResettable.OnReturn()` and initialized on `OnRent()`. `[PoolResettableMethod]` marks a method that handles that reset/initialize work for one or more of those members, for cases where it isn't done inline in `OnRent`/`OnReturn`. `[PoolDisposableMember]` marks a member that must be disposed rather than merely reset.

An analyzer in `CodeBoost.CodeAnalysis.Analyzers` checks every `IPoolResettable` type against its declared `[PoolResettableMember]` fields and fails the build if one is left out of the reset path. A pooled type that forgets to clear a marked member is a build error, not a runtime surprise.

## Environment and Mathematics

`IApplicationState`, reached through the static `ApplicationState` class, answers `IsEditor()`, `IsDevelopmentBuild()`, `IsGuiBuild()`, `IsHeadlessBuild()`, `IsPlaying()`, and `IsQuitting()`. `LoggingService` uses it to pick which `LoggerLevel` applies.

`MathCb`, in `CodeBoost.Mathematics`, is a static partial class of floating-point and vector utility methods. `RoundingType` (`Down`, `Up`, `UpNonZero`, `ToEven`, `AwayFromZero`) selects the rounding rule for the integer divide extension methods.
