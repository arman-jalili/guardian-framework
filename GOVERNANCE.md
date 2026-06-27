# Guardian Framework Governance

This document describes the governance model for the Guardian Framework open-source project.

## Maintainers

Current maintainers:

- **Arman Wolkensteiner-Jalili** — [arman.jalili.dev@gmail.com](mailto:arman.jalili.dev@gmail.com) — Project creator and lead maintainer

## Decision-Making

### Consensus-Based Decisions

Major decisions (architecture changes, breaking API changes, new major features) are made by:
1. Opening a discussion issue with a proposal
2. Allowing at least 7 days for community input
3. Achieving lazy consensus (no objections from maintainers within the comment period)

### BDFL Reserve Powers

The project lead retains BDFL (Benevolent Dictator for Life) reserve powers for:
- Security vulnerability responses
- Legal or licensing decisions
- Situations where consensus cannot be reached within a reasonable timeframe

These powers are intended as a last resort and should rarely be exercised.

## Contribution Workflow

1. **Discuss** — Open an issue or discussion for non-trivial changes
2. **Fork & branch** — Create a feature branch from `main`
3. **Implement** — Follow the guidelines in [CONTRIBUTING.md](CONTRIBUTING.md)
4. **Validate** — All quality gates must pass (tests, lint, typecheck, build)
5. **Review** — Submit a PR for review by at least one maintainer
6. **Merge** — PR requires at least one maintainer approval

## Release Process

| Version | Frequency | Criteria |
|---------|-----------|----------|
| `0.x.y` (pre-release) | At will | All tests pass |
| `1.0.0` (stable) | TBD | API stability, docs complete, CI/CD hardened |

### Release Checklist

1. Update `CHANGELOG.md` with release date
2. Update version in `package.json` and `src/index.ts`
3. Create a GitHub Release with semantic version tag
4. The release workflow publishes to npm automatically

## Code of Conduct

All contributors and community members are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Credits

This governance model is inspired by the [Django](https://www.djangoproject.com/foundation/) and [Node.js](https://nodejs.org/en/about/governance/) projects.
