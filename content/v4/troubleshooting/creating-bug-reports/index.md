---
title: "Creating Bug Reports"
---

A well-crafted bug report will result in bugs being resolved much quicker.

New bug reports can be created on the [FishNet GitHub Issues page](https://github.com/FirstGearGames/FishNet/issues). You will need to be logged into GitHub to create a bug report.

## Keep an Eye on Your Reports

If your bug report is missing information we may close it out asking you to submit a new report.

Sometimes bug reports perfectly meet our guidelines but require more information. When this happens we will notify you in the bug report of what information we need, and place a "waiting on information" flag on it. If we do request more information and receive no response within 2 weeks the report will likely be closed to keep prioritization and order. You can still comment on closed reports and we will re-open them as needed.

## Issue Template

When creating a new issue on our GitHub you will be presented with a template. See below for detailed information on how to complete each section.

### Necessary Information

When filling out your report please include the following:

- Unity version
- Fish-Networking version
- Discord link where you troubleshot the issue

> **Info:** If you are not able to join our Discord to troubleshoot, please specify this in place of the Discord link. We still expect you to troubleshoot the issue locally if you are unable to connect with our helpers.
>
> Leaving your Discord name in our server, or email address (less preferred), will allow us to contact you if you're unresponsive to the bug report while we still need more information.

### Description

Provide a brief description of the bug report. This should be a summary of what causes the bug or how it is affecting your project.

### Replication

In an ordered fashion, provide step-by-step details on how to reproduce the bug. Be sure to indicate if starting as client or server, if multiple builds must be running, what actions to take, and so on.

### Expected Behavior

Describe what you expect the behavior to be. This helps us know if the result is intended, and could give us insight on what may be going wrong.

### Media

If there is any media or content that could assist us in resolving your issue, please provide it here. Media could include images, stack traces, videos, links, and more. If you are providing code samples or stack traces please use text.

### Sample Project

A sample project is not always required, but at times issues are too complex to reproduce using the issue template alone. When that is the case we will ask you to create a sample project. When including a sample project, also state how to use it.

## Sample Project Guidelines

Sample projects should always follow these guidelines to keep them simple and small.

All samples must be within their own folder so when imported into a Unity project they will not be merged with other files. For example: `MyBugReport\Scripts`, `MyBugReport\Prefabs`, etc.

Provide only the files needed to reproduce the problem. Do not include extra models, prefabs, code, or anything unrelated to the issue. Delete any code in provided scripts that does not directly affect the bug.

Do not include Fish-Networking within your sample project — only include the files needed to reproduce the problem.

Use the old input system.

Export as a `.unitypackage`: right-click your folder, choose **Export Package**, and uncheck **Include Dependencies** at the bottom.

> **Info:** GitHub does not allow uploading `.unitypackage` files. You may need to archive your exported package before uploading. Please use zip format.

> **Warning:** Model files can be large and pink materials are not fun to look at! If possible, replace models with standard meshes and use the standard render pipeline.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/bug-report-files-to-export.png)
