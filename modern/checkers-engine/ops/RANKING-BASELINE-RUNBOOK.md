# Initial Ranking Baseline — rollout gate

Status: mandatory rollout condition for the first historical ranking baseline build.

**INITIAL RANKING BASELINE = WRITE-QUIESCENT / CONTROLLED MIGRATION GATE**

Before the first historical baseline build on an existing deployment:

1. Drain or stop older application replicas that can still commit terminal Checkers/Tysiąc game writes, or otherwise place terminal-result writes behind a controlled write-quiescent gate.
2. Verify that no uncontrolled live terminal-game writers can cross the migration boundary.
3. Start the new-version ranking schema/baseline initialization and allow the historical baseline plus bounded catch-up to complete.
4. Verify ranking initialization/catch-up health before restoring ordinary terminal-game writes.

Do not run the first historical baseline concurrently with uncontrolled terminal-game writes from older replicas unless global ordering across that migration boundary has been explicitly proven.

This note is rollout evidence only. It does not change C1 runtime ranking semantics and authorizes no production action.
