---
title: "Benchmark Setup"
---

Everything looks good on paper but dedicated benchmarks can show you what to really expect.

## Setup

- New scene with Camera and directional light.
- 1 object per player connection.
- Object moves and rotates randomly.
- Object has a client authoritative NetworkTransform with 100ms send rate.
- Object sends two ServerRPCs a second.
- Server sends an ObserverRPC for every ServerRPC it receives.
- Every client is it's own executable.
- Server tick rate is set to 10 (every 100ms).

## Gathering results

Performance results are determined by setting a server at it's highest possible frame rate and comparing frame time as more variables or clients are introduced.

Bandwidth results are discovered by using tools which come with the operating system, and averaging bandwidth per second.

## Scripts

These are the scripts created specifically to benchmark and ensure test are performed equally.

**MovingAverage.cs**

```csharp
using FishNet.Documenting;
using System;
using UnityEngine;

namespace FishNet.Managing.Timing
{
    [APIExclude]
    public class MovingAverage
    {
        #region Public.
        /// <summary>
        /// Average from samples favoring the most recent sample.
        /// </summary>
        public float Average { get; private set; }
        #endregion

        /// <summary>
        /// Next index to write a sample to.
        /// </summary>
        private int _writeIndex;
        /// <summary>
        /// Collected samples.
        /// </summary>
        private float[] _samples;
        /// <summary>
        /// Number of samples written. Will be at most samples size.
        /// </summary>
        private int _writtenSamples;
        /// <summary>
        /// Samples accumulated over queue.
        /// </summary>
        private float _sampleAccumulator;

        public MovingAverage(int sampleSize)
        {
            if (sampleSize < 0)
            {
                sampleSize = 0;
            }
            else if (sampleSize < 2)
            {
                if (NetworkManager.StaticCanLog(Logging.LoggingType.Warning))
                    Debug.LogWarning("Using a sampleSize of less than 2 will always return the most recent value as Average.");
            }
            _samples = new float[sampleSize];
        }

        /// <summary>
        /// Computes a new windowed average each time a new sample arrives
        /// </summary>
        /// <param name="newSample"></param>
        public void ComputeAverage(float newSample)
        {
            if (_samples.Length <= 1)
            {
                Average = newSample;
                return;
            }

            _sampleAccumulator += newSample;
            _samples[_writeIndex] = newSample;

            // Increase writeIndex.
            _writeIndex++;
            _writtenSamples = Math.Max(_writtenSamples, _writeIndex);
            if (_writeIndex >= _samples.Length)
                _writeIndex = 0;

            Average = _sampleAccumulator / _writtenSamples;

            /* If samples are full then drop off
             * the oldest sample. This will always be
             * the one just after written. The entry isn't
             * actually removed from the array but will
             * be overwritten next sample. */
            if (_writtenSamples >= _samples.Length)
                _sampleAccumulator -= _samples[_writeIndex];
        }
    }
}
```

**DisplayPerformance.cs**

```csharp
using UnityEngine;
using FishNet;
using FishNet.Managing.Timing;

public class DisplayPerformance : MonoBehaviour
{
    public int TargetFrameRate = 60;
    private float _nextDisplayTime = 0f;
    private MovingAverage _average = new MovingAverage(3);
    private uint _frames = 0;

    private void Update()
    {
#if UNITY_SERVER
        Application.targetFrameRate = TargetFrameRate;
        _frames++;
        if (Time.time < _nextDisplayTime)
            return;

        _average.ComputeAverage(_frames);
        _frames = 0;
        // Update display twice a second.
        _nextDisplayTime = Time.time + 1f;

        double avgFrameRate = _average.Average;
        // Performance lost.
        double lost = avgFrameRate / (double)TargetFrameRate;
        lost = (1d - lost);

        // Replace this with the equivelent of your networking solution.
        int clientCount = InstanceFinder.ServerManager.Clients.Count;
        Debug.Log($"Average {lost.ToString("0.###")} performance lost with {clientCount} clients.");
#elif UNITY_EDITOR
        // Max out editor frames to test client side scalability.
        Application.targetFrameRate = 9999;
#else
        /* Limit client frame rate to 15
         * so your computer doesn't catch fire when opening
         * hundreds of clients. */
        Application.targetFrameRate = 15;
#endif
    }
}
```

**SimulatePlayer.cs**

```csharp
using FishNet.Object;
using UnityEngine;

public class SimulatePlayer : NetworkBehaviour
{
    private float _nextMoveUpdate = 0f;
    private float _nextRpc = 0f;
    private Vector3 _posGoal;
    private Quaternion _rotGoal;

    private void Update()
    {
        if (!base.IsOwner)
            return;

        transform.position = Vector3.MoveTowards(transform.position, _posGoal, Time.deltaTime * 3f);
        transform.rotation = Quaternion.RotateTowards(transform.rotation, _rotGoal, Time.deltaTime * 20f);

        if (Time.time > _nextRpc)
        {
            _nextRpc = Time.time + 0.5f;
            ServerRpc();
        }

        if (Time.time > _nextMoveUpdate)
        {
            bool rotate = (Random.Range(0f, 1f) <= 0.5f);
            bool x = (Random.Range(0f, 1f) <= 0.5f);
            bool y = (Random.Range(0f, 1f) <= 0.5f);
            bool z = (Random.Range(0f, 1f) <= 0.5f);

            if (!x && !y && !z)
                x = true;

            transform.position = _posGoal;
            transform.rotation = _rotGoal;

            float xPos = (x) ? Random.Range(-30f, 30f) : transform.position.x;
            float yPos = (y) ? Random.Range(-30f, 30f) : transform.position.y;
            float zPos = (z) ? Random.Range(-30f, 30f) : transform.position.z;

            _nextMoveUpdate = Time.time + 2f;
            _posGoal = new Vector3(xPos, yPos, zPos);

            if (rotate)
                _rotGoal = Quaternion.Euler(
                    Random.Range(-80f, 80f),
                    Random.Range(-80f, 80f),
                    Random.Range(-80f, 80f)
                );
        }
    }

    [ServerRpc]
    private void ServerRpc()
    {
        ObserversRpc();
    }

    [ObserversRpc]
    private void ObserversRpc() { }
}
```
