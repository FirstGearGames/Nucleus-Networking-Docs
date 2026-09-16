---
title: "Performance"
---

Prior to Fish-Networking we developed assets for other solutions, such as Mirror Networking. These assets have proven to perform 4 times faster, and use little as 13% the bandwidth of Mirror's internal components. Unfortunately, third party assets can only go so far. This is strongly in part why Fish-Networking was made.

Fish-Networking has been designed with performance and bandwidth in mind. Features are regularly benchmarked for client and server performance, as well bandwidth consumption; these metrics are important while deploying. Better performance allows your project to run on cheaper hardware, and enables a higher concurrent user count. By using less bandwidth Fish-Networking reduces your server bills.

## Bandwidth

**Networked Objects (moving)**

In most games moving objects will contribute the majority of used bandwidth. Fish-Networking's bandwidth consumption competes aggressively against modern paid solutions, and does better than any other free solution.

**Remote Procedure Calls**

Remote procedure calls, shortened to RPCs, are commonly placed second in bandwidth consumption. RPCs are used to communicate between the server and client. Fish-Networking uses only two bytes per RPC, while other free solutions use a minimum of 23 bytes.

## CPU

Another very important aspect is how well the networking solution scales. A better scaling solution ensures it will run on less expensive hardware, and get you closer to your MMO goals.

**Network Object Count (idle)**

It's not uncommon for frameworks to lose performance as more networked objects are spawned. Fish-Networking retains nearly 100% of it's performance regardless of how many objects are spawned.

**Concurrent Users**

Fish-Networking retains a large amount of performance with hundreds of users updating every tick. Other networking solutions have shown to slow down drastically as more concurrent users join the server.

**Client Experience**

With more objects, users, or activity even clients can be affected by a poorly designed networking solution. Fish-Networking has scored roughly 70% more frames per second on clients than other free solutions, such as Mirror.
