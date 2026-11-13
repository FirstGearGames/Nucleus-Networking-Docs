---
title: "How the benchmarks are run"
---

Every framework runs a tick rate of 30. The server and the client are separate standalone builds. The results are on the [Nucleus website](https://nucleus-networking.com/).

## Every object runs the same movement script

The bandwidth and CPU tests move their objects with this script. Each object drifts in a straight line inside a sphere while it spins, and reflects off the sphere's edge. Each framework's own networked script runs it on the server once per network tick, and the framework's transform component replicates it.

It draws no random numbers while moving. Every drift speed, spin speed and spin axis comes from tables of 300 entries, built once from fixed seeds, and every other drift speed in the table is 5 times faster. Each framework's spawner hands every object its place in the spawn order through `Number`: the object starts on that entry, takes the next entry at each bounce, and eases to it linearly over 3 seconds, counted in ticks. The same numbers give every object the same course on every run and every framework.

```csharp
using UnityEngine;

/// <summary>
/// CPU benchmark only: moves an object only when the engine's tick calls <see cref="Tick"/>, so every engine does the same work per tick.
/// The object drifts in a straight line and spins on its own axis, reflecting off a sphere of <see cref="Radius"/>. Drift and spin speeds
/// come from two shared tables of <see cref="SpeedCount"/> predetermined entries: an object starts on the entry its number picks, at once
/// begins easing to the next entry, and takes the next entry of both at every bounce, easing to them linearly over <see cref="RampSeconds"/>.
/// The spin axis comes from a third table and switches to the new entry's axis at each bounce. Its whole course comes only from <see cref="Number"/>, so the
/// same number gives the same course on every engine.
/// </summary>
public class CpuBenchMover : MonoBehaviour
{
    public const float Radius = 16f;
    // The demo's movement speed range and multiplier: each speed is drawn between the two, and every odd entry multiplies both ends.
    public const float MinimumSpeed = 0.5f;
    public const float MaximumSpeed = 2f;
    public const float SpeedRangeMultiplier = 5f;
    // The demo's spin range, in degrees per second; spin is never multiplied.
    public const float MinimumSpin = 5f;
    public const float MaximumSpin = 65f;
    public const int SpeedCount = 300;
    public const float RampSeconds = 3f;

    // One table for every object, built once from a fixed seed, so half of its entries are multiplied and no random numbers are drawn
    // while moving.
    private static readonly float[] Speeds = BuildTable(2463534242u, MinimumSpeed, MaximumSpeed, SpeedRangeMultiplier);
    private static readonly float[] Spins = BuildTable(88675123u, MinimumSpin, MaximumSpin, 1f);
    private static readonly Vector3[] SpinAxes = BuildAxes(521288629u);

    // RampSeconds in ticks, worked out on the first tick, so a ramp is a count of ticks rather than a time.
    private static int _rampTicks;

    private int _speedIndex;
    private float _speed;
    private float _spin;
    // Added to _speed and _spin on each tick of a ramp, until _rampTicksLeft runs out; -1 starts a ramp on the next tick.
    private float _speedStep;
    private float _spinStep;
    // This tick's rotation, and what it is multiplied by each tick of a ramp. Both turn about the same axis, so multiplying adds their
    // angles: the spin ramps with one quaternion multiply per tick and no trigonometry outside a ramp's start and end.
    private Quaternion _tickRotation;
    private Quaternion _tickRotationStep;
    private int _rampTicksLeft;
    private Vector3 _direction;
    private Vector3 _spinAxis;

    /// <summary>
    /// Gives the object its number in the benchmark, picks its first speed from the table and places it at the start of its course. The spawner calls
    /// this right after it instantiates the object.
    /// </summary>
    /// <param name="number">The object's number, unique within the run; the spawner's loop index.</param>
    public void Number(uint number)
    {
        // xorshift32 seeded from the number, so the course is identical on every engine and scripting backend.
        uint state = number * 2654435761u + 1u;
        // Start on the number's entry and head for the next one; the ramp starts on the first tick, once the tick interval is known.
        _speedIndex = (int)(number % SpeedCount);
        _speed = Speeds[_speedIndex];
        _spin = Spins[_speedIndex];
        _spinAxis = SpinAxes[_speedIndex];
        _speedIndex = (_speedIndex + 1) % SpeedCount;
        _rampTicksLeft = -1;

        Vector3 position = new Vector3(Next(ref state) * 2f - 1f, Next(ref state) * 2f - 1f, Next(ref state) * 2f - 1f) * Radius * 0.5f;
        _direction = UnitVector(ref state);
        transform.SetPositionAndRotation(position, Quaternion.LookRotation(UnitVector(ref state)));
    }

    /// <summary>
    /// Advances the object by one tick.
    /// </summary>
    /// <param name="tickDelta">The engine's tick interval in seconds.</param>
    public void Tick(float tickDelta)
    {
        if (_rampTicksLeft < 0)
            StartRamp(tickDelta);
        if (_rampTicksLeft > 0)
        {
            _speed += _speedStep;
            _tickRotation = _tickRotationStep * _tickRotation;
            // The last step lands exactly on the targets, so float drift never builds up.
            if (--_rampTicksLeft == 0)
            {
                _speed = Speeds[_speedIndex];
                _spin = Spins[_speedIndex];
                _tickRotation = Quaternion.AngleAxis(_spin * tickDelta, _spinAxis);
            }
            else
            {
                _spin += _spinStep;
            }
        }

        Vector3 position = transform.position + _direction * (_speed * tickDelta);
        if (position.sqrMagnitude > Radius * Radius)
        {
            _direction = Vector3.Reflect(_direction, position.normalized);
            position = position.normalized * Radius;
            // The next drift and spin speeds in the tables, reached over RampSeconds from wherever the current ramp has got to.
            _speedIndex = (_speedIndex + 1) % SpeedCount;
            _spinAxis = SpinAxes[_speedIndex];
            StartRamp(tickDelta);
        }
        transform.SetPositionAndRotation(position, _tickRotation * transform.rotation);
    }

    // Eases from the current drift and spin to the entry at _speedIndex over RampSeconds, counted in ticks.
    private void StartRamp(float tickDelta)
    {
        if (_rampTicks == 0)
            _rampTicks = Mathf.Max(1, Mathf.RoundToInt(RampSeconds / tickDelta));
        _speedStep = (Speeds[_speedIndex] - _speed) / _rampTicks;
        _spinStep = (Spins[_speedIndex] - _spin) / _rampTicks;
        _rampTicksLeft = _rampTicks;
        // The rotation is from the current spin, about the axis just switched to; the step adds one tick's worth of spin change per tick.
        _tickRotation = Quaternion.AngleAxis(_spin * tickDelta, _spinAxis);
        _tickRotationStep = Quaternion.AngleAxis(_spinStep * tickDelta, _spinAxis);
    }

    // Each entry drawn between minimum and maximum from a fixed seed; every odd entry is multiplied by oddMultiplier.
    private static float[] BuildTable(uint seed, float minimum, float maximum, float oddMultiplier)
    {
        float[] table = new float[SpeedCount];
        uint state = seed;
        for (int index = 0; index < SpeedCount; index++)
            table[index] = Mathf.Lerp(minimum, maximum, Next(ref state)) * (index % 2 == 1 ? oddMultiplier : 1f);
        return table;
    }

    private static Vector3[] BuildAxes(uint seed)
    {
        Vector3[] axes = new Vector3[SpeedCount];
        uint state = seed;
        for (int index = 0; index < SpeedCount; index++)
            axes[index] = UnitVector(ref state);
        return axes;
    }

    // A value in [0, 1).
    private static float Next(ref uint state)
    {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        return (state >> 8) * (1f / 16777216f);
    }

    private static Vector3 UnitVector(ref uint state)
    {
        float z = Next(ref state) * 2f - 1f;
        float angle = Next(ref state) * 2f * Mathf.PI;
        float r = Mathf.Sqrt(1f - z * z);
        return new Vector3(r * Mathf.Cos(angle), r * Mathf.Sin(angle), z);
    }
}
```

## Bandwidth is counted by a relay on the client's machine

Measuring starts 10 seconds after the client holds all 200 objects and lasts 120 seconds. Positions and rotations are replicated at a precision of 0.001 and accurate to the tick. The server and one client run on the same machine, both capped at 90 frames per second, and a relay between them delays every packet by 85 ms each way, a 170 ms round trip. The relay counts every byte and packet the server sends. The bytes counted are divided by the 120 seconds, the 200 objects and the 30 ticks a second, which gives bytes per object, per tick.

## Server CPU is measured by a monitor in the server process

The server runs on an AWS c7i.large, capped at 60 frames per second, with 300 objects and again with 2,000. Its clients run on a separate machine and connect 0.3 seconds apart, 50 of them and then 150. Measuring starts 45 seconds after the server counts all of that run's clients as connected and lasts 30 seconds. The monitor below measures the CPU time of the whole server process and divides it by the frames the server ran. A framework that cannot hold 30 ticks a second, or that does not get every client connected and holding its objects, is marked as failed.

Each client observes half of the objects, never all of them. Which half is a seeded random pick, so it is the same on every run and on every framework:

- An object's number is its place in the spawn order, read from the framework's own network id.
- A client's seed is the order it first reaches the server's visibility check: the first client is seed 1, the second seed 2, and so on. The server therefore holds the same set of halves on every run, which is all its CPU cost depends on.
- Each half is exactly half of the objects, picked by a Fisher-Yates shuffle driven by SplitMix64.

Every framework decides each client's half once, with its own visibility feature, when the client joins. Nothing re-checks it on a timer:

| Framework | Visibility feature used |
|---|---|
| Nucleus | An interest condition on each object, with the manager's evaluation cadence switched off |
| FishNet 5 | A Normal observer condition added to the ObserverManager's default conditions |
| Mirror | A custom InterestManagement that never rebuilds on a timer |
| NGO | `NetworkObject.CheckObjectVisibility` on each object |

A client waits until it holds its half before the run counts it, and every run checks that each client ended up holding exactly half.

```csharp
using System;
using System.Collections.Generic;

/// <summary>
/// Each client observes exactly half of the objects, a seeded random pick that is the same on every run and every framework.
/// </summary>
public static class BeltBenchInterest
{
    private static readonly Dictionary<object, bool[]> SetsByClient = new();

    /// <summary>
    /// The number of objects a peer waits for before it starts: half on a client, all of them on the server.
    /// </summary>
    public static int ExpectedObjects(int count, bool isClient) => isClient ? count / 2 : count;

    /// <summary>
    /// Whether the client behind clientKey observes the object at objectNumber. A new client takes the next seed.
    /// </summary>
    public static bool IsObserved(object clientKey, int objectNumber, int count)
    {
        if (!SetsByClient.TryGetValue(clientKey, out bool[] observed))
        {
            observed = CreateSet(SetsByClient.Count + 1, count);
            SetsByClient.Add(clientKey, observed);
        }

        return (uint)objectNumber < (uint)observed.Length && observed[objectNumber];
    }

    /// <summary>
    /// Ranks network ids in ascending order, which is spawn order on every framework, so the rank is the object's number.
    /// </summary>
    public static Dictionary<T, int> RankBySpawnOrder<T>(IEnumerable<T> objects, Func<T, ulong> networkId)
    {
        List<T> sorted = new(objects);
        sorted.Sort((a, b) => networkId(a).CompareTo(networkId(b)));
        Dictionary<T, int> ranks = new(sorted.Count);
        for (int index = 0; index < sorted.Count; index++)
            ranks[sorted[index]] = index;

        return ranks;
    }

    /// <summary>
    /// Exactly half of count objects, picked by a Fisher-Yates shuffle driven by SplitMix64 from seed.
    /// </summary>
    public static bool[] CreateSet(int seed, int count)
    {
        int[] order = new int[count];
        for (int index = 0; index < count; index++)
            order[index] = index;

        ulong state = (ulong)seed * 0x9E3779B97F4A7C15UL;
        for (int index = count - 1; index > 0; index--)
        {
            state += 0x9E3779B97F4A7C15UL;
            ulong mixed = state;
            mixed = (mixed ^ (mixed >> 30)) * 0xBF58476D1CE4E5B9UL;
            mixed = (mixed ^ (mixed >> 27)) * 0x94D049BB133111EBUL;
            mixed ^= mixed >> 31;
            int swapIndex = (int)(mixed % (ulong)(index + 1));
            (order[index], order[swapIndex]) = (order[swapIndex], order[index]);
        }

        bool[] observed = new bool[count];
        for (int index = 0; index < count / 2; index++)
            observed[order[index]] = true;

        return observed;
    }
}
```

:::hint type="info"
Thank you to Kreyg for providing this CPU logger script.
:::

```csharp
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using UnityEngine;
using Debug = UnityEngine.Debug;

/// <summary>
/// Stack-agnostic CPU logger for headless runs. Waits for every client to connect, then a grace period, then fixed windows, then everything is printed once at the end
/// (per-window lines, mean and median), so logging never runs during a measured window.
/// </summary>
/// <remarks>
/// Process CPU % is relative to ONE core: 100% means one full core busy. Measures whole-process CPU time, all threads.
/// On Windows builds the time comes from QueryProcessCycleTime, converted with a cycles-per-millisecond rate calibrated by a short
/// busy spin at start. GetProcessTimes only charges whole 15.6 ms clock ticks to whichever thread is running at each tick, so a
/// light 60 fps process whose frames keep landing between ticks reads several times too low; its figure is still logged for comparison.
/// Window results are stored in a preallocated array, so nothing allocates while measuring.
/// </remarks>
public class CpuLogger : MonoBehaviour
{
    [SerializeField]
    [Tooltip("Label printed with the results, e.g. 'Purr Off 300 showcase'.")]
    private string _label = "run";
    [SerializeField]
    [Tooltip("Clients that must be connected before the grace period starts, e.g. 50 or 150.")]
    private int _expectedClientCount = 50;
    [SerializeField]
    [Tooltip("Seconds to wait after every client connects before the first window, so spawning and JIT settle.")]
    private float _graceSeconds = 45f;
    [SerializeField]
    [Tooltip("Length of each window, in seconds.")]
    private float _windowSeconds = 30f;
    [SerializeField]
    [Tooltip("How many windows to record. More windows make the median more robust to one-off spikes.")]
    private int _windowCount = 1;
    [SerializeField]
    [Tooltip("Frame rate to lock to, so every stack runs the same number of frames. 0 leaves it alone.")]
    private int _targetFrameRate = 60;
    [SerializeField]
    [Tooltip("Quit the application after printing the results.")]
    private bool _quitWhenDone = true;

    private struct WindowResult
    {
        public double WallSeconds;
        public double CpuMs;
        public double TickCpuMs;
        public int Frames;
        public int Gen0;
        public float WorstFrameMs;
        public double HeapMb;
    }

    /// <summary>
    /// Clients connected to the server. Each framework's probe sets this from its own connection events.
    /// </summary>
    public int ConnectedClientCount { get; set; }

    private Process _process;
    private WindowResult[] _results;
    private double[] _sortBuffer;
    private float _allClientsConnectedTime;
    private bool _isAllClientsConnected;
    private bool _isWarm;
    private bool _isDone;
    private int _windowIndex;

    private float _windowStartTime;
    private double _windowStartCpuMs;
    private double _windowStartTickCpuMs;
    private double _cyclesPerMs;
    private int _windowStartFrame;
    private int _windowStartGen0;
    private float _worstFrameMs;

#if UNITY_STANDALONE_WIN && !UNITY_EDITOR
    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentProcess();

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetProcessTimes(IntPtr process, out long creationTime, out long exitTime, out long kernelTime, out long userTime);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool QueryProcessCycleTime(IntPtr process, out ulong cycleTime);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentThread();

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool QueryThreadCycleTime(IntPtr thread, out ulong cycleTime);
#endif

#if UNITY_STANDALONE_LINUX && !UNITY_EDITOR
    // struct rusage on 64-bit Linux: ru_utime (sec, usec), ru_stime (sec, usec), then 14 more longs.
    private const int RusageSelf = 0;
    private readonly long[] _rusage = new long[18];

    [DllImport("libc", SetLastError = true)]
    private static extern int getrusage(int who, [Out] long[] usage);
#endif

    private void Start()
    {
        if (_targetFrameRate > 0 && Application.isBatchMode)
        {
            QualitySettings.vSyncCount = 0;
            Application.targetFrameRate = _targetFrameRate;
        }

        _process = Process.GetCurrentProcess();
        _results = new WindowResult[_windowCount];
        _sortBuffer = new double[_windowCount];
#if UNITY_STANDALONE_WIN && !UNITY_EDITOR
        // Busy-spin this thread for 100 ms wall time, three times; the fastest rate seen is the least preempted one.
        for (int attempt = 0; attempt < 3; attempt++)
        {
            QueryThreadCycleTime(GetCurrentThread(), out ulong startCycles);
            Stopwatch stopwatch = Stopwatch.StartNew();
            while (stopwatch.Elapsed.TotalMilliseconds < 100d)
            {
            }
            QueryThreadCycleTime(GetCurrentThread(), out ulong endCycles);
            _cyclesPerMs = Math.Max(_cyclesPerMs, (endCycles - startCycles) / stopwatch.Elapsed.TotalMilliseconds);
        }
        Debug.Log($"[CPU] cycle rate {_cyclesPerMs / 1000d:F1} MHz");
#endif
    }

    private void Update()
    {
        if (_isDone)
        {
            return;
        }

        float now = Time.realtimeSinceStartup;

        if (!_isAllClientsConnected)
        {
            if (ConnectedClientCount < _expectedClientCount)
            {
                return;
            }

            _isAllClientsConnected = true;
            _allClientsConnectedTime = now;
        }

        if (!_isWarm)
        {
            if (now - _allClientsConnectedTime < _graceSeconds)
            {
                return;
            }

            _isWarm = true;
            BeginWindow(now);
            return;
        }

        float frameMs = Time.unscaledDeltaTime * 1000f;
        if (frameMs > _worstFrameMs)
        {
            _worstFrameMs = frameMs;
        }

        if (now - _windowStartTime < _windowSeconds)
        {
            return;
        }

        EndWindow(now);
        _windowIndex++;

        if (_windowIndex < _windowCount)
        {
            BeginWindow(now);
            return;
        }

        _isDone = true;
        PrintResults();

        if (_quitWhenDone)
        {
            Application.Quit();
        }
    }

    /// <summary>
    /// Total CPU time this process has used, in milliseconds, across all threads.
    /// </summary>
    /// <remarks>On Windows builds this asks the OS directly, since Process.TotalProcessorTime is coarse or zero under Unity.</remarks>
    private double GetProcessCpuMs()
    {
#if UNITY_STANDALONE_WIN && !UNITY_EDITOR
        if (_cyclesPerMs > 0d && QueryProcessCycleTime(GetCurrentProcess(), out ulong cycles))
        {
            return cycles / _cyclesPerMs;
        }
#endif
        return GetTickCpuMs();
    }

    /// <summary>
    /// Total CPU time from the OS's tick-sampled counters, as measured before cycle time; logged next to the cycle figure for comparison.
    /// </summary>
    private double GetTickCpuMs()
    {
#if UNITY_STANDALONE_WIN && !UNITY_EDITOR
        if (GetProcessTimes(GetCurrentProcess(), out long _, out long _, out long kernelTime, out long userTime))
        {
            // FILETIME units are 100 nanoseconds.
            return (kernelTime + userTime) / 10000d;
        }
#endif
#if UNITY_STANDALONE_LINUX && !UNITY_EDITOR
        if (getrusage(RusageSelf, _rusage) == 0)
        {
            // User + system time: seconds to ms, plus microseconds to ms.
            return (_rusage[0] + _rusage[2]) * 1000d + (_rusage[1] + _rusage[3]) / 1000d;
        }
#endif
        _process.Refresh();
        return _process.TotalProcessorTime.TotalMilliseconds;
    }

    private void BeginWindow(float now)
    {
        _windowStartTime = now;
        _windowStartCpuMs = GetProcessCpuMs();
        _windowStartTickCpuMs = GetTickCpuMs();
        _windowStartFrame = Time.frameCount;
        _windowStartGen0 = GC.CollectionCount(0);
        _worstFrameMs = 0f;
    }

    private void EndWindow(float now)
    {
        _results[_windowIndex] = new WindowResult
        {
            WallSeconds = now - _windowStartTime,
            CpuMs = GetProcessCpuMs() - _windowStartCpuMs,
            TickCpuMs = GetTickCpuMs() - _windowStartTickCpuMs,
            Frames = Time.frameCount - _windowStartFrame,
            Gen0 = GC.CollectionCount(0) - _windowStartGen0,
            WorstFrameMs = _worstFrameMs,
            HeapMb = GC.GetTotalMemory(forceFullCollection: false) / 1048576d,
        };
    }

    private void PrintResults()
    {
        StringBuilder builder = new();
        builder.AppendLine($"[CPU] {_label} results ({_windowCount} x {_windowSeconds:F0}s, logged after the run):");

        double totalCpuMs = 0d;
        double totalTickCpuMs = 0d;
        double totalWallSeconds = 0d;
        int totalFrames = 0;
        int totalGen0 = 0;
        float overallWorstFrameMs = 0f;

        for (int i = 0; i < _windowCount; i++)
        {
            WindowResult result = _results[i];
            double cpuPercent = result.CpuMs / (result.WallSeconds * 10d);
            double msPerFrame = result.CpuMs / Math.Max(result.Frames, 1);

            builder.AppendLine($"[CPU] window {i + 1}: CPU {cpuPercent:F1}%, {msPerFrame:F3} ms/frame, " +
                               $"{result.Frames / result.WallSeconds:F1} fps, worst frame {result.WorstFrameMs:F1} ms, " +
                               $"GC gen0 {result.Gen0}, heap {result.HeapMb:F1} MB");

            totalCpuMs += result.CpuMs;
            totalTickCpuMs += result.TickCpuMs;
            totalWallSeconds += result.WallSeconds;
            totalFrames += result.Frames;
            totalGen0 += result.Gen0;

            if (result.WorstFrameMs > overallWorstFrameMs)
            {
                overallWorstFrameMs = result.WorstFrameMs;
            }

            _sortBuffer[i] = msPerFrame;
        }

        double medianMsPerFrame = Median(_sortBuffer);

        for (int i = 0; i < _windowCount; i++)
        {
            _sortBuffer[i] = _results[i].CpuMs / (_results[i].WallSeconds * 10d);
        }

        double medianCpuPercent = Median(_sortBuffer);

        builder.AppendLine($"[CPU] {_label} MEAN: CPU {totalCpuMs / (totalWallSeconds * 10d):F1}%, " +
                           $"{totalCpuMs / Math.Max(totalFrames, 1):F3} ms/frame, {totalFrames / totalWallSeconds:F1} fps");
        builder.AppendLine($"[CPU] {_label} MEDIAN: CPU {medianCpuPercent:F1}%, {medianMsPerFrame:F3} ms/frame");
        builder.AppendLine($"[CPU] {_label} TICK-SAMPLED MEAN: CPU {totalTickCpuMs / (totalWallSeconds * 10d):F1}%, {totalTickCpuMs / Math.Max(totalFrames, 1):F3} ms/frame");
        builder.Append($"[CPU] {_label} worst frame {overallWorstFrameMs:F1} ms, GC gen0 {totalGen0}, " +
                       $"heap {_results[_windowCount - 1].HeapMb:F1} MB");

        Debug.Log(builder.ToString());
    }

    private static double Median(double[] values)
    {
        Array.Sort(values);

        int middle = values.Length / 2;

        if (values.Length % 2 == 0)
        {
            return (values[middle - 1] + values[middle]) / 2d;
        }

        return values[middle];
    }
}
```

## Server garbage is counted by Unity's allocation counter

Measuring starts after a 1 minute warm-up and lasts 1 minute. The server spawns one object per tick from the framework's own pool. Each object writes 3 values on each of its next 2 ticks and is despawned on its third tick. The garbage Unity reports for every frame is added up and divided by the ticks measured. Unity only reports it in Development Builds, so both builds are Development Builds with script debugging off.

The script that spawns the objects and writes their values is different for each framework, so only the measuring part is shown:

```csharp
// The garbage-measuring part of the benchmark probe. Each framework supplies CurrentTick(), its own tick counter.

// GC Allocated In Frame is only reported by development players; release players leave it invalid.
private static Unity.Profiling.ProfilerRecorder _gcAllocatedRecorder;
private long _gcAllocatedBytes;
private uint _tickAtMeasureStart;

// At start-up:
_gcAllocatedRecorder = Unity.Profiling.ProfilerRecorder.StartNew(Unity.Profiling.ProfilerCategory.Memory, "GC Allocated In Frame");

// When the warm-up ends:
_gcAllocatedBytes = 0;
_tickAtMeasureStart = CurrentTick();

// Every frame of the measured window:
if (_gcAllocatedRecorder.Valid)
    _gcAllocatedBytes += _gcAllocatedRecorder.LastValue;

// When the window ends:
uint ticks = CurrentTick() - _tickAtMeasureStart;
double allocatedBytesPerTick = ticks == 0 ? 0d : (double)_gcAllocatedBytes / ticks;
```

## Fusion runs with 100 objects

Fusion throttles beyond 100 objects. Its bandwidth is measured with 100 objects, since its bytes per object do not change with the count, and its CPU results are marked as failed.
