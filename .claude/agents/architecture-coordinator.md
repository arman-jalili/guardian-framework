---
name: architecture-coordinator
description: Turn goals into bounded execution streams
model: sonnet
temperature: 0.1
extends: ../../.pi/agents/architecture-coordinator.md
---

# architecture coordinator Agent

**This is a platform wrapper.** Core content in `.pi/agents/architecture-coordinator.md`.

## Claude-Specific Notes

- Use `extends:` to inherit core content from pi source
- Integrate with preflight engine: `./scripts/ci/run_preflight.sh`
- Use Claude workflows for multi-step execution

## Claude Integration

```bash
# Run preflight before agent invocation
./scripts/ci/run_preflight.sh --json

# Validate agent output
python scripts/ci/validate_agent_output.py --input=output.md
```

---

**Token count:** ~30 lines (wrapper only)
