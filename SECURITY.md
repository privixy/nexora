# Security Policy

Thanks for helping keep Nexora and its users safe.

## Supported versions

Only the latest released version receives security fixes.

## Reporting a vulnerability

Do not open a public issue for security problems. Report privately through GitHub Security Advisories for this repository.

## Scope

Nexora is a desktop database client with an MCP layer that lets AI agents run queries against local database connections. Reports that are especially in scope include:

- Bypasses of MCP read-only mode or write-approval gates
- SQL that reaches a database in a way the safety layer should block
- Exposure of stored credentials or connection secrets
- Unapproved actions from untrusted MCP or prompt-injected input

## What to include

- Description and impact
- Affected component, file or function
- Steps to reproduce or proof of concept
- Threat model
- Suggested mitigation, if known
