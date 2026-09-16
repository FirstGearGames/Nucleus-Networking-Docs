---
title: "Fish-Networking vs Mirror"
---

> **Danger:** These benchmarks are very old. Server outbound bandwidth metrics have changed.
>
> As of the date 2023/08/26 Mirror is believed to be approximately 5% more efficient in bandwidth, and Fish-Networking about 90-95% more efficient in bandwidth.
>
> Example:
>
> If Mirror previously sent 100mB/s they are now expected to send 95mB/s. If Fish-Networking previously sent 100mB/s it would now send 5mB/s.

## Versions

- Fish-Networking v1.4.3
- Mirror Networking v66.0.3

## Results

**Hardware**

- Windows Server 2019
- AMD EPYC 7402P 24-Core (1 SLICE/CORE USED!)
- 2.00 GB RAM

**100 CCU Scaling**

- FishNet Server lost 1.5% of it's performance.
- FishNet Client ran at 1350 FPS.
- Mirror Server lost 29.5% of it's performance.
- Mirror Client ran at 791 FPS.

**200 CCU Scaling**

- FishNet Server lost 7.4% of it's performance.
- Mirror Server lost 83.2% of it's performance.
- Clients were untested.

**100 CCU Bandwidth**

- FishNet Server per second sent 7.3mB (adjusted 0.55mB) and received 1.1mB.
- Mirror Server per second sent 31.8mB (adjusted 30.2mB) and received 3.2mB.

**200 CCU Bandwidth**

- FishNet Server per second sent 29.9mB (adjusted 2.24mB) and received 2.2mB.
- Mirror Server per second sent 94.3mb (adjusted 89.6mB) and received 4.8mB.

**Spawned Network Objects (idle)**

| Objects | Fish-Networking | Mirror |
|---|---|---|
| 0 | 1.5ms | 1.5ms |
| 500 | 1.5ms | 1.9ms |
| 1000 | 1.5ms | 2.2ms |
| 2000 | 1.5ms | 2.9ms |
| 4000 | 1.5ms | 4.2ms |

## Results Summary

- **Client FPS:** FishNet clients achieved 70% more FPS than Mirror.
- **Bandwidth:** FishNet used 67-78% less bandwidth than Mirror.
- **Server Performance (200 CCU):** FishNet retained 92.6% server performance, while Mirror retained only 16.8% performance.
- **Server Performance (4000 idle objects):** FishNet retained 100% server performance, while Mirror retained only 36% performance.
