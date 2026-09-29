# Gracz.pl — SEO

Status: `ACTIVE DOCUMENTATION AREA / DESIGN ONLY`  
Repository: `developergracz/gracz-pl-2`  
Owner: Czesław Socha  
Created: 2026-09-29

## Purpose

This directory is the durable entry point for SEO documentation for Gracz.pl.

Two scopes are intentionally separated:

1. `GRACZ-PL-SEO-HOMEPAGE-R1/` — homepage-specific SEO work and audit evidence.
2. `GRACZ-SEO-01-SEO-CONTROL-CENTER/` — long-term SEO platform design for continuous technical SEO, content intelligence, internal linking, Search Console analytics, alerts and administration.

The SEO Control Center is a design package. Its existence in the repository does not authorize implementation, deployment, automatic publication, production changes, database changes or Search Console actions.

## Canonical system package

Start here:

`GRACZ-SEO-01-SEO-CONTROL-CENTER/README.md`

That README defines:
- system purpose,
- document reading order,
- module boundaries,
- implementation sequence,
- quality gates,
- resume protocol for future sessions.

## Core rule

SEO automation may automate detection, measurement, validation, generation of technical metadata and recommendations. It must not automatically publish large volumes of AI-generated pages, create hidden text, doorway pages, manipulative links or bypass editorial/Owner approval.

## Status vocabulary

- `DESIGN ONLY` — specification exists, implementation has not started.
- `READY FOR IMPLEMENTATION REVIEW` — design package is complete enough to be independently reviewed.
- `IMPLEMENTATION AUTHORIZED` — explicit Owner authorization exists for a named phase.
- `PASS` — a defined gate passed on a locked source identity.
- `HOLD` — a gate cannot safely continue.
- `CLOSED` — phase is implemented, reviewed and evidence is recorded.

When resuming in the future, do not infer implementation status from the existence of these documents. Read the package status and verify the repository/runtime independently.
