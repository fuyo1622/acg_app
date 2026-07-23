# Security Policy

## Supported version

Security fixes are provided for the latest production deployment and the latest release on the default branch.

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue.

When this repository is public, use GitHub's **Report a vulnerability** form under the repository Security tab. Include:

- A concise description of the issue and its impact.
- Reproduction steps or a minimal proof of concept.
- Affected browser, operating system, route, and application version.
- Whether local collection data, backup files, or origin storage are affected.

If private vulnerability reporting is not yet enabled, open a public issue containing no exploit details or private data and ask the maintainer to provide a private reporting channel.

The maintainer should acknowledge a complete report within seven days and provide a status update after triage. Timelines for remediation depend on severity and reproducibility.

## Scope notes

ACG Collector is a client-side, local-first PWA. Reports involving IndexedDB data handling, backup import/export, service worker caching, deployment headers, dependency vulnerabilities, or unauthorized data transmission are in scope.
