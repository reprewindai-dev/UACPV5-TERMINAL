# Veklom & ABIDE Sovereign Agentic Control Plane

This repository contains the core architecture, schemas, and governance specifications for the Veklom and ABIDE agentic ecosystem. Built under the strict guidelines of the Agentic AI Foundation (AAIF) and locked under Constitution v4.02.1.

## Core Invariant: ABIDE Proposes, CAPPO Disposes

To prevent autonomous agentic drift, the planning layer (ABIDE) is mathematically decoupled from the authorization layer (CAPPO). ABIDE compiles human intent into a proposed execution graph, which CAPPO independently evaluates against deterministic policies before any state-changing action is executed.

## Getting Started

1. Deploy the sovereign BYOS backend using PostgreSQL.
2. Configure the Interlink cAPI router to discover local capabilities.
3. Initialize the CAPPO policy engine with your organizational rules.
4. Anchor all execution evidence to the PGL ledger.