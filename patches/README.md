# Dependency security patches

`braces@3.0.3.patch` mitigates [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
(CVE-2026-93687). As of 2026-10-14 no fixed package version is published.
Tailwind's build-only `micromatch` dependency uses braces to parse string glob
patterns; recursive AST walkers can overflow the stack on deep input. The patch
rejects more than 128 nested braces or parentheses before any recursive walk.
Normal, escaped, and boundary-depth patterns retain their behavior. It does not
claim to validate manually constructed AST objects or bound expansion breadth.

`bun run audit` first checks the actual installed braces copies used by the
project and Tailwind/micromatch. It exercises the vulnerable string-input paths
(`parse`, `compile`, `expand`, `stringify`), mixed nesting and unclosed patterns,
then audits every other high/critical advisory. Only the mitigated advisory ID
is excluded because the registry audit cannot recognize local patches. Removing
or failing to apply the patch makes the first step fail; this was verified with
an unpatched install in a disposable worktree. `scripts/verify.sh` also runs this
offline regression gate. The package version remains 3.0.3.

Replace this patch and its scoped audit exclusion with the official fixed
version when one becomes available. Do not broaden the exclusion list.
