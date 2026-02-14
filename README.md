# Software Factory Template

AI-agent-powered personal software factory. Specification-driven, secure by design, testing first.

## How It Works

1. Human describes a feature in natural language
2. AI agents produce a structured spec, implementation plan, tests, and code
3. Automated CI verifies security, correctness, and conventions
4. Human reviews and approves via pull request

## Repository Structure

```
factory/     - Agent control plane (specs, plans, decisions, reviews)
src/         - Application code
tests/       - Contract, integration, security, and e2e tests
infra/       - Infrastructure as code
docs/        - Governance documents (agents read these before every task)
```

## Key Documents

- [AGENTS.md](docs/AGENTS.md) - Agent roles and operating rules
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design and deployment topology
- [CONVENTIONS.md](docs/CONVENTIONS.md) - Coding standards
- [SECURITY_BASELINE.md](docs/SECURITY_BASELINE.md) - Security control matrix
- [tiering.yaml](tiering.yaml) - Agent decision authority levels
