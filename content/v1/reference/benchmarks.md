---
title: "How the benchmarks are run"
---

Every framework runs a tick rate of 30. The server and the client are separate standalone builds. The results are on the [Nucleus website](https://nucleus-networking.com/).

## Every object runs the same movement script

The bandwidth tests move their objects with this script, with linear motion on. Each object drifts in a straight line across a tilted belt while it spins, and reflects off the belt's rim. Each framework's own networked script runs it on the server, and the framework's transform component replicates it.

Each framework's spawner hands every object its place in the spawn order through `AssignNumber`, and that number decides how the object moves:

- Half of the objects multiply their speed range by 5.
- A quarter move like rigidbodies. Their speed and spin never settle: both glide from one end of their range to the other and back, 4 seconds each way, so they are always accelerating.
- The other three quarters move like character controllers. At each bounce they take a new speed, spin speed and spin direction at once, and hold them until the next bounce.

The two splits are interleaved, so half of the rigidbody quarter and half of the character controllers are fast. The same seed and numbers make the belt move the same way on every run.

```csharp
using UnityEngine;

public class BeltedAsteroid : MonoBehaviour
{
    public const float MinimumSpeedRangeMultiplier = 1f;
    public const float MaximumSpeedRangeMultiplier = 20f;

    [SerializeField]
    [Tooltip("Drift in a straight line and reflect off the belt's outer rim instead of orbiting the center.")]
    private bool _isLinearMotion;
    [SerializeField]
    [Tooltip("The slowest self-spin a cube draws, in degrees per second.")]
    private float _minimumRotationDegreesPerSecond = 5f;
    [SerializeField]
    [Tooltip("The fastest self-spin a cube draws, in degrees per second.")]
    private float _maximumRotationDegreesPerSecond = 65f;
    [SerializeField]
    [Tooltip("The slowest ground speed a cube draws, in units per second: the drift speed in linear mode, the tangential speed in orbit mode.")]
    private float _minimumMovementSpeed = 0.5f;
    [SerializeField]
    [Tooltip("The fastest ground speed a cube draws, in units per second: the drift speed in linear mode, the tangential speed in orbit mode.")]
    private float _maximumMovementSpeed = 2f;
    [SerializeField]
    [Tooltip("The factor half of the asteroids multiply their movement speed range by, from 1 to 20. Applied once as each asteroid wakes.")]
    private float _speedRangeMultiplier = 5f;
    [SerializeField]
    [Tooltip("How likely the ground speed is drawn near the maximum: 1 always picks the max, 0.5 draws uniformly.")]
    private float _movementSpeedFullnessChance = 0.5f;
    [SerializeField]
    [Tooltip("How likely the self-spin speed is drawn near the maximum: 1 always picks the max, 0.5 draws uniformly.")]
    private float _rotationSpeedFullnessChance = 0.5f;
    [SerializeField]
    [Tooltip("The seed of the whole belt. The same seed draws the same courses for every asteroid on every run; a different one draws a different belt.")]
    private uint _seed = 1u;

    private float _orbitRadius;
    private float _orbitHeight;
    private float _orbitAngle;
    private float _orbitAngularSpeed;
    private Vector3 _spinAxis;
    private SpeedRamp _rotationRamp;
    private Vector2 _linearPosition;
    private Vector2 _linearDirection;
    private SpeedRamp _linearSpeedRamp;
    private float _cubeMinimumMovementSpeed;
    private float _cubeMaximumMovementSpeed;
    private bool _isSpeedSnappedAtBounce;
    private bool _isMovementSweepRising;
    private bool _isSpinSweepRising;
    private AsteroidRandom _random;

    private static readonly Vector3 OrbitCenter = Vector3.zero;
    private static readonly Quaternion BeltTilt = Quaternion.Euler(27f, 0f, 14f);
    private const float BeltOuterRadius = 16f;
    private const float SpeedSweepDuration = 4f;
    private const float MinimumLinearStartRadiusFraction = 0.7f;
    private const float MaximumLinearStartRadiusFraction = 0.97f;

    public void AuthorityUpdate(float frameSeconds) => Advance(frameSeconds);

    public void AuthorityTick(float stepSeconds) => Advance(stepSeconds);

    public void AssignNumber(uint asteroidNumber) => SeedMotion(asteroidNumber);

    private void Awake()
    {
        SeedMotion((uint)transform.GetSiblingIndex());
    }

    private void SeedMotion(uint asteroidNumber)
    {
        _random = AsteroidRandom.ForAsteroid(_seed, asteroidNumber);

        float speedRangeMultiplier = asteroidNumber % 2u == 1u ? Mathf.Clamp(_speedRangeMultiplier, MinimumSpeedRangeMultiplier, MaximumSpeedRangeMultiplier) : 1f;
        _cubeMinimumMovementSpeed = _minimumMovementSpeed * speedRangeMultiplier;
        _cubeMaximumMovementSpeed = _maximumMovementSpeed * speedRangeMultiplier;
        _isSpeedSnappedAtBounce = asteroidNumber / 2u % 4u != 0u;

        _orbitHeight = _random.NextRange(minimum: -1.25f, maximum: 1.25f);
        _rotationRamp.Reset(BiasedSpeed(ref _random, _minimumRotationDegreesPerSecond, _maximumRotationDegreesPerSecond, _rotationSpeedFullnessChance));
        _spinAxis = _random.NextUnitVector();

        if (_isLinearMotion)
        {
            float startAngle = _random.NextRange(minimum: 0f, maximum: 2f * Mathf.PI);
            float startRadius = _random.NextRange(MinimumLinearStartRadiusFraction, MaximumLinearStartRadiusFraction) * BeltOuterRadius;
            Vector2 radial = new(Mathf.Cos(startAngle), Mathf.Sin(startAngle));
            _linearPosition = radial * startRadius;

            _linearDirection = new(-radial.y, radial.x);
            _linearSpeedRamp.Reset(BiasedSpeed(ref _random, _cubeMinimumMovementSpeed, _cubeMaximumMovementSpeed, _movementSpeedFullnessChance));

            if (!_isSpeedSnappedAtBounce)
            {
                bool isSweepStartedAtMaximum = asteroidNumber / 8u % 2u == 1u;
                _linearSpeedRamp.Reset(isSweepStartedAtMaximum ? _cubeMaximumMovementSpeed : _cubeMinimumMovementSpeed);
                _rotationRamp.Reset(isSweepStartedAtMaximum ? _maximumRotationDegreesPerSecond : _minimumRotationDegreesPerSecond);
                _isMovementSweepRising = isSweepStartedAtMaximum;
                _isSpinSweepRising = isSweepStartedAtMaximum;
            }
        }
        else
        {
            _orbitRadius = _random.NextRange(minimum: 8f, maximum: BeltOuterRadius);
            _orbitAngle = _random.NextRange(minimum: 0f, maximum: 2f * Mathf.PI);

            _orbitAngularSpeed = BiasedSpeed(ref _random, _cubeMinimumMovementSpeed, _cubeMaximumMovementSpeed, _movementSpeedFullnessChance) / _orbitRadius;
        }

        transform.position = _isLinearMotion ? BeltWorldPosition(_linearPosition) : OrbitPosition();
    }

    private void Advance(float deltaSeconds)
    {
        if (_isLinearMotion)
            DriveLinearMotion(deltaSeconds);
        else
            DriveOrbitMotion(deltaSeconds);

        _rotationRamp.Advance(deltaSeconds);

        if (_isLinearMotion && !_isSpeedSnappedAtBounce)
            ContinueSweep(ref _rotationRamp, ref _isSpinSweepRising, _minimumRotationDegreesPerSecond, _maximumRotationDegreesPerSecond);

        transform.Rotate(_spinAxis * (_rotationRamp.Current * deltaSeconds), Space.Self);
    }

    private void DriveOrbitMotion(float deltaSeconds)
    {
        _orbitAngle += _orbitAngularSpeed * deltaSeconds;
        transform.position = OrbitPosition();
    }

    private void DriveLinearMotion(float deltaSeconds)
    {
        _linearSpeedRamp.Advance(deltaSeconds);

        if (!_isSpeedSnappedAtBounce)
            ContinueSweep(ref _linearSpeedRamp, ref _isMovementSweepRising, _cubeMinimumMovementSpeed, _cubeMaximumMovementSpeed);

        _linearPosition += _linearDirection * (_linearSpeedRamp.Current * deltaSeconds);

        float distance = _linearPosition.magnitude;

        if (distance > BeltOuterRadius)
        {
            Vector2 normal = _linearPosition / distance;
            _linearDirection = Vector2.Reflect(_linearDirection, normal);
            _linearPosition = normal * BeltOuterRadius;

            if (_isSpeedSnappedAtBounce)
            {
                _rotationRamp.Reset(BiasedSpeed(ref _random, _minimumRotationDegreesPerSecond, _maximumRotationDegreesPerSecond, _rotationSpeedFullnessChance));
                _spinAxis = _random.NextUnitVector();
                _linearSpeedRamp.Reset(BiasedSpeed(ref _random, _cubeMinimumMovementSpeed, _cubeMaximumMovementSpeed, _movementSpeedFullnessChance));
            }
        }

        transform.position = BeltWorldPosition(_linearPosition);
    }

    private Vector3 OrbitPosition() =>
        BeltWorldPosition(new(Mathf.Cos(_orbitAngle) * _orbitRadius, Mathf.Sin(_orbitAngle) * _orbitRadius));

    private Vector3 BeltWorldPosition(Vector2 planePosition) =>
        OrbitCenter + BeltTilt * new Vector3(planePosition.x, _orbitHeight, planePosition.y);

    private static float BiasedSpeed(ref AsteroidRandom asteroidRandom, float minimumSpeed, float maximumSpeed, float fullnessChance)
    {
        if (fullnessChance >= 1f)
            return maximumSpeed;

        if (fullnessChance <= 0f)
            return minimumSpeed;

        float exponent = (1f - fullnessChance) / fullnessChance;
        float fraction = Mathf.Pow(asteroidRandom.NextSingle(), exponent);

        return Mathf.Lerp(minimumSpeed, maximumSpeed, fraction);
    }

    private static void ContinueSweep(ref SpeedRamp speedRamp, ref bool isSweepRising, float minimumSpeed, float maximumSpeed)
    {
        if (!speedRamp.IsSettled)
            return;

        isSweepRising = !isSweepRising;
        speedRamp.SetTarget(isSweepRising ? maximumSpeed : minimumSpeed, SpeedSweepDuration);
    }

    private struct SpeedRamp
    {
        public float Current { get; private set; }
        public bool IsSettled => _elapsedSeconds >= _durationSeconds;

        private float _startValue;
        private float _targetValue;
        private float _elapsedSeconds;
        private float _durationSeconds;

        public void Reset(float value)
        {
            _startValue = value;
            _targetValue = value;
            _elapsedSeconds = 0f;
            _durationSeconds = 0f;
            Current = value;
        }

        public void SetTarget(float target, float durationSeconds)
        {
            _startValue = Current;
            _targetValue = target;
            _elapsedSeconds = 0f;
            _durationSeconds = durationSeconds;
        }

        public void Advance(float deltaTime)
        {
            if (IsSettled)
            {
                Current = _targetValue;

                return;
            }

            _elapsedSeconds += deltaTime;
            Current = Mathf.Lerp(_startValue, _targetValue, Mathf.Clamp01(_elapsedSeconds / _durationSeconds));
        }
    }
}
```

```csharp
using UnityEngine;

public struct AsteroidRandom
{
    private ulong _state;
    private ulong _increment;

    private const ulong Multiplier = 6364136223846793005UL;

    public AsteroidRandom(ulong initialState, ulong sequence)
    {
        _state = 0UL;
        _increment = (sequence << 1) | 1UL;

        NextUInt32();

        _state += initialState;

        NextUInt32();
    }

    public uint NextUInt32()
    {
        ulong previousState = _state;
        _state = unchecked((previousState * Multiplier) + _increment);

        uint xorShifted = (uint)(((previousState >> 18) ^ previousState) >> 27);
        int rotation = (int)(previousState >> 59);

        return (xorShifted >> rotation) | (xorShifted << ((-rotation) & 31));
    }

    public float NextSingle() => (NextUInt32() >> 8) * (1f / 16777216f);

    public float NextRange(float minimum, float maximum) => minimum + ((maximum - minimum) * NextSingle());

    public Vector3 NextUnitVector()
    {
        float height = (2f * NextSingle()) - 1f;
        float angle = 2f * Mathf.PI * NextSingle();
        float radius = Mathf.Sqrt(Mathf.Max(0f, 1f - (height * height)));

        return new(radius * Mathf.Cos(angle), radius * Mathf.Sin(angle), height);
    }

    public static AsteroidRandom ForAsteroid(uint seed, uint asteroidIndex) => new(Mix(((ulong)seed << 32) | asteroidIndex), asteroidIndex);

    private static ulong Mix(ulong value)
    {
        unchecked
        {
            value += 0x9E3779B97F4A7C15UL;
            value = (value ^ (value >> 30)) * 0xBF58476D1CE4E5B9UL;
            value = (value ^ (value >> 27)) * 0x94D049BB133111EBUL;

            return value ^ (value >> 31);
        }
    }
}
```

## Bandwidth is counted by a relay on the client's machine

Measuring starts 10 seconds after the client holds all 200 objects and lasts 60 seconds. Positions and rotations are replicated at a precision of 0.001 and accurate to the tick. The server and one client run on the same machine, both capped at 90 frames per second, and a relay between them delays every packet by 75 ms each way, a 150 ms round trip. The relay counts every byte and packet the server sends. The bytes counted are divided by the 60 seconds, the 200 objects and the 30 ticks a second, which gives bytes per object, per tick.

## Server CPU is measured by a monitor in the server process

The server runs on an AWS c7i.large, capped at 60 frames per second, with 200 objects and again with 2,000. Its clients run on a separate machine and connect 0.3 seconds apart, 50 of them and then 200. Measuring starts 2 minutes after the last client connects and lasts 10 seconds. The monitor below measures the CPU time of the whole server process and divides it by the frames the server ran. A framework that cannot hold 30 ticks a second is marked as failed.

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
/// Stack-agnostic CPU logger for headless runs. Warmup, then fixed windows, then everything is printed once at the end
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
    [Tooltip("Seconds to wait before the first window, so spawning and JIT settle.")]
    private float _warmupSeconds = 5f;
    [SerializeField]
    [Tooltip("Length of each window, in seconds.")]
    private float _windowSeconds = 20f;
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

    private Process _process;
    private WindowResult[] _results;
    private double[] _sortBuffer;
    private float _startTime;
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
        _startTime = Time.realtimeSinceStartup;
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

        if (!_isWarm)
        {
            if (now - _startTime < _warmupSeconds)
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
