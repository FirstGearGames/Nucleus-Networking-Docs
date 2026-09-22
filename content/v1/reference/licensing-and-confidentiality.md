---
title: "Licensing and confidentiality"
---

## The notice on the binary

Nucleus.dll carries its own identification, independent of this documentation or the website. If a copy ends up somewhere on its own, the assembly metadata still names who owns it and where the terms live:

- `AssemblyTitle` / `AssemblyProduct` — "Nucleus"
- `AssemblyCompany` — "FirstGearGames"
- `AssemblyCopyright` — "Copyright (c) 2026 FirstGearGames. All rights reserved."
- An `AssemblyMetadata` entry named `License`, stating that the software is confidential pre-release software, licensed and not sold, that redistribution and disclosure are prohibited, and pointing at `https://nucleus-networking.com/legal/usage-agreement`

This is edition-neutral: Free and Pro builds carry the same notice.

## What ships with the package

The download includes a `LICENSE.txt` headed **CONFIDENTIAL PRE-RELEASE SOFTWARE**. It states that Nucleus is licensed, not sold, to one named beta tester for evaluation and internal development, and that redistribution and disclosure are prohibited. Read it before you do anything with the package beyond building against it — it is not boilerplate.

## Confidential Information

The beta agreement classifies the package's contents as confidential: the assemblies, their internals, the network protocol, the API surface, and any measurement of how it performs. In practice, that means:

- No public reproduction repositories. Don't push a project that includes Nucleus, or a fork of it, anywhere public.
- No public issue tracker. File bugs and questions through the channels FirstGearGames provides, not a public tracker that others can read.
- No published benchmark figures. Performance numbers, comparisons, and profiling results are covered by the same confidentiality as the rest of the package.
- No commercial release of a title built on Nucleus during the beta without separate written permission from FirstGearGames.

## Licensing is not uniform across the tree

Not every file in this repository is under the same terms:

- **CodeBoost** and **CodeAnalysis** are public submodules (`.gitmodules` points them at `github.com/FirstGearGames/CodeBoost` and `github.com/FirstGearGames/CodeAnalysis`) with their own licensing. You can legitimately read and fork those.
- The **Nucleus engine assembly** and **SynapseSocket** are not public submodules — SynapseSocket ships only as a compiled DLL here, with no accompanying source tree in this repository.

Don't assume MIT (or any other permissive) terms for a component just because a neighboring one is public. Check what's actually verifiable for that specific piece before relying on it.

## What this means for this documentation

You're reading this site under the same beta agreement that governs the package itself. Nothing here — code samples, API names, or explanations — is a license to redistribute, publish, or disclose beyond what the agreement permits. The current agreement text, and the record of when you accepted it, live on the Nucleus website: the full text is at `https://nucleus-networking.com/legal/usage-agreement`, and acceptance is recorded there when you download the package.

## Brand assets

The Nucleus logos live under `Media/` in this repository (`Nucleus Logo Solid.png`, `Nucleus Logo Transparent.png`, and the source `.psd`). The icons under `Nucleus.Website/public/brand/` are third-party engine logos (Unity, Godot, and similar) used to indicate integration targets — they are not Nucleus's own branding. No usage rules for the Nucleus logos are published yet.
