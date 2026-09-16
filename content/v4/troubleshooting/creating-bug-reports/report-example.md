---
title: "Report Example"
---
This is an example of what a created bug report might look like.

Below is a bug report for a `SyncVar` which is not sending updates to clients. Headers are shown here for clarity, but you do not need to include them in your actual report.

> **Info:** If troubleshooting was not performed or applicable fields are missing in the bug report there is a fair chance the submitter would be asked to update their issue, and until then the issue would be suspended.

---

**Unity version:** Unity 2021.3.10f

**FishNet Version:** FishNet 4.3.1

**Discord Troubleshot Link / What I've tried:** https://discord.com/channels/123456

**Description:** When I set a SyncVar on the server, non-host clients do not get the update. Callbacks are not working either.

**Replication:**

This can be reproduced in two editors.

1. Start the 1st editor as host or server.
2. In a player `NetworkBehaviour` script, update an `int` SyncVar in `Awake`, wrapped in an `InstanceFinder.IsServerStarted` check.
3. Start the 2nd editor as client only.
4. Have the 1st editor spawn the player object for the 2nd editor.

**Expectation:**

- Both the 1st and 2nd editor get callbacks.
- The SyncVar value should synchronize to the 2nd editor.

---

At a glance this would suggest everything is working as intended. The server is not active on the 2nd editor (client only), so the `InstanceFinder.IsServerStarted` check is failing and the value is never applied locally. The 1st editor is not sending the value because SyncTypes set in `Awake` are assumed to be applied on both server and client, since `Awake` always fires regardless of network state.

Although this is covered in the SyncType documentation, the behavior could be something of a gotcha. If the developers' troubleshooting steps would not have caught this, they would likely provide the explanation above and ask the developer to close the issue if it were now resolved.
