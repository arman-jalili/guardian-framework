# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

Guardian scaffolds files into user projects and executes validator commands. If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue for security vulnerabilities.
2. Email [your-email] or open a [GitHub Security Advisory](https://github.com/arman-jalili/guardian-framework/security/advisories/new).
3. Include:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and aim to resolve critical issues within 7 days.

## Security Considerations

### Trust-Gated Configuration

Guardian uses a trust system for project-local validator configs (`.pi/validators/*.toml`). Untrusted configs are flagged. Use `guardian trust` to review and approve.

### Validator Execution

Validator commands defined in TOML configs are executed via `bash -lc`. Only trust validator sources you verify. The `--verify` flag runs inline tests without executing commands.

### Path Safety

Extensions like `bash-guard.ts` and `security-guards.md` implement path safety guards and command deny-lists. These are scaffolded into user projects, not enforced by the CLI itself.

### Template Integrity

The CLI scaffolds from bundled templates. If you suspect template tampering, verify the installed package checksum against the published npm registry.
