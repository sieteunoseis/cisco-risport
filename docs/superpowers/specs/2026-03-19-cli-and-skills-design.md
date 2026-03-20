# Design Spec: cisco-risport CLI & Skills

**Date:** 2026-03-19
**Status:** Proposed
**Author:** Jeremy Worden

---

## Overview

Add a production-quality CLI (`cisco-risport`) to the existing `cisco-risport` npm package, following the same patterns established by `cisco-dime` and `cisco-axl`. The CLI wraps the `risPortService` class to provide real-time device registration status queries against Cisco CUCM via RisPort70 SOAP.

A companion Superpowers skill (`skills/cisco-risport-cli/SKILL.md`) enables the CLI to be driven by AI agents.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| CLI framework | Commander.js (no `enablePositionalOptions()`) | Matches cisco-dime/cisco-axl pattern; global flags work anywhere |
| Global flags access | `cmd.optsWithGlobals()` in action handlers | Consistent with cisco-dime; avoids positional option pitfalls |
| Config storage | `~/.cisco-risport/config.json` | Per-tool isolation; mirrors cisco-dime pattern |
| Audit log | `~/.cisco-risport/audit.jsonl`, 10MB rotation | Consistent with cisco-dime; enables forensics |
| Output formats | table, json, toon, csv | Full parity with cisco-dime/cisco-axl |
| ESM bridging (toon/update-notifier) | `import("...").then(...)` async pattern | Both packages are ESM-only; CJS entry point requires dynamic import |
| Cookie scoping | Key by `host\|serviceUrl` | RisPort has a single SOAP endpoint per host; single scope is sufficient |
| CUCM version flag | Omitted (`--no-cucm-version`) | RisPort70 endpoint does not require a version parameter |
| Pagination | `--auto-page` flag on `query` | Calls `selectCmDevicePaginated`; transparent to user |
| Batch mode | `--select-items` list > 1000 → auto-batch | Calls `selectCmDeviceBatched`; respects API limits |
| Array returns | Always return arrays | Even single-node results; consistent for formatter layer |
| TLS | `--insecure` global flag → `NODE_TLS_REJECT_UNAUTHORIZED=0` | Lab environments; matches cisco-dime pattern |
| Env vars | `CUCM_HOST` and `CUCM_HOSTNAME` both accepted | Backward compat with existing user environments |
| Source location | `cli/` directory, plain JavaScript (CJS) | Mirrors cisco-dime; imports library from `main.js` |
| Test framework | `node:test` (built-in) | No extra deps; matches cisco-dime/cisco-axl |

---

## Command Structure

```
cisco-risport [global options] <command> [command options]
```

### Global Flags

| Flag | Description | Default |
|---|---|---|
| `--format <type>` | Output format: table, json, toon, csv | table |
| `--host <host>` | CUCM hostname (overrides config/env) | — |
| `--username <user>` | CUCM username (overrides config/env) | — |
| `--password <pass>` | CUCM password (overrides config/env) | — |
| `--cluster <name>` | Use a specific named cluster from config | — |
| `--insecure` | Skip TLS certificate verification | false |
| `--no-audit` | Disable audit logging for this command | — |
| `--debug` | Enable debug logging | false |

### Commands

#### `config`

```
cisco-risport config add <name>      --host <h> --username <u> --password <p> [--insecure]
cisco-risport config use <name>
cisco-risport config list
cisco-risport config show
cisco-risport config remove <name>
cisco-risport config test
```

`config add` reads `--host/--username/--password` from `cmd.optsWithGlobals()` with manual validation (not `requiredOption`). This allows flags before or after the subcommand:

```bash
# Both equivalent:
cisco-risport --host 10.0.0.1 --username admin --password secret config add lab
cisco-risport config add lab --host 10.0.0.1 --username admin --password secret
```

#### `query`

Wraps `selectCmDevice` / `selectCmDeviceExt`.

```
cisco-risport query [options]
```

| Option | Description | Default |
|---|---|---|
| `--device-class <class>` | Phone, Gateway, H323, Cti, VoiceMail, MediaResources, HuntList, SIPTrunk, Unknown, Any | Any |
| `--status <status>` | Registered, UnRegistered, Rejected, PartiallyRegistered, Unknown, Any | Any |
| `--select-by <field>` | Name, IPV4Address, IPV6Address, DirNumber, Description, SIPStatus | Name |
| `--select-items <items>` | Comma-separated device names/IPs/numbers | — |
| `--model <id>` | Model number or name (255 = any) | 255 |
| `--protocol <proto>` | SIP, SCCP, Unknown, Any | Any |
| `--node <name>` | Filter to a specific CUCM node | — |
| `--max <n>` | Maximum results per page | 1000 |
| `--extended` | Use SelectCmDeviceExt for additional fields | false |
| `--auto-page` | Auto-paginate through all results | false |

Examples:

```bash
# All registered phones
cisco-risport query --device-class Phone --status Registered

# Specific devices by name
cisco-risport query --select-by Name --select-items SEP001122334455,SEP001122334466

# Gateways in JSON format
cisco-risport query --device-class Gateway --format json

# Extended query, all results, paginated
cisco-risport query --device-class Phone --extended --auto-page

# Ad-hoc credentials, debug
cisco-risport query --host 10.0.0.1 --username admin --password secret --debug
```

#### `cti`

Wraps `selectCtiDevice`.

```
cisco-risport cti [options]
```

| Option | Description | Default |
|---|---|---|
| `--class <class>` | Provider, Device, Line | Provider |
| `--status <status>` | Open, Closed, Any | Any |
| `--node <name>` | Filter to a specific CUCM node | — |
| `--app-by <field>` | AppID or UserID | AppID |
| `--app-item <name>` | Application ID or user ID to filter on | — |
| `--dev-name <name>` | Device name filter | — |
| `--dir-number <number>` | Directory number filter | — |
| `--max <n>` | Maximum results | 1000 |

Examples:

```bash
# All open CTI providers
cisco-risport cti --class Provider --status Open

# CTI devices for a specific application
cisco-risport cti --class Device --app-by AppID --app-item CiscoJabber

# Lines assigned to a directory number
cisco-risport cti --class Line --dir-number 1001
```

#### `models`

Wraps `returnModels()`. Outputs the model ID-to-name lookup table.

```
cisco-risport models [--format json]
```

Examples:

```bash
cisco-risport models
cisco-risport models --format json | jq '.[] | select(.name | test("7965"))'
```

#### `status-reasons`

Wraps `returnStatusReasons()`. Outputs the status reason code-to-description lookup table.

```
cisco-risport status-reasons [--format json]
```

Examples:

```bash
cisco-risport status-reasons
cisco-risport status-reasons --format csv
```

#### `summary`

Convenience command. Calls `selectCmDevice` for each major device class and displays a registration summary table — a quick cluster health dashboard.

```
cisco-risport summary [options]
```

| Option | Description | Default |
|---|---|---|
| `--node <name>` | Filter to a specific CUCM node | — |
| `--extended` | Use SelectCmDeviceExt | false |

Device classes queried: Phone, Gateway, H323, Cti, VoiceMail, MediaResources, HuntList, SIPTrunk.

Output columns: `class`, `registered`, `unregistered`, `rejected`, `partial`, `unknown`, `total`.

Examples:

```bash
# Cluster health at a glance
cisco-risport summary

# Node-specific summary
cisco-risport summary --node cucm-pub.example.com

# Export to CSV
cisco-risport summary --format csv > cluster-health.csv
```

---

## Configuration & Auth

### Precedence (highest to lowest)

1. CLI flags (`--host`, `--username`, `--password`)
2. Environment variables (`CUCM_HOST` or `CUCM_HOSTNAME`, `CUCM_USERNAME`, `CUCM_PASSWORD`)
3. Named cluster (`--cluster <name>`)
4. Active cluster (`~/.cisco-risport/config.json`)

### Config File

Path: `~/.cisco-risport/config.json`

```json
{
  "activeCluster": "lab",
  "clusters": {
    "lab": {
      "host": "10.0.0.1",
      "username": "admin",
      "password": "secret",
      "insecure": true
    },
    "prod": {
      "host": "cucm.example.com",
      "username": "risport-svc",
      "password": "<ss:42:password>"
    }
  }
}
```

### Secret Server Support

Passwords may contain `<ss:ID:field>` placeholders, resolved at runtime via `ss-cli`:

```json
"password": "<ss:42:password>"
```

### Error Messages

| Condition | Message |
|---|---|
| No cluster configured | `No cluster configured. Set one up with: cisco-risport config add <name> ...` |
| Auth failure (401) | `Authentication failed. Hint: Run "cisco-risport config test" to verify your credentials.` |
| Rate limited (429) | `Rate limit exceeded. Hint: Reduce query frequency or use --auto-page with smaller --max values.` |
| TLS error | `TLS certificate error. Hint: Use --insecure for self-signed certificates.` |
| ss-cli not available | `Config contains Secret Server references (<ss:...>) but ss-cli is not available. Install with: npm install -g @sieteunoseis/ss-cli` |

---

## Output Formatting

All commands support `--format table|json|toon|csv`.

### `query` table output (default)

```
┌──────────────────────┬────────────┬────────────┬───────┬──────────────────────────┐
│ Name                 │ Status     │ IPAddress  │ Model │ Description              │
├──────────────────────┼────────────┼────────────┼───────┼──────────────────────────┤
│ SEP001122334455      │ Registered │ 10.0.1.100 │ 7965  │ Alice Smith              │
│ SEP001122334466      │ Registered │ 10.0.1.101 │ 7965  │ Bob Jones                │
└──────────────────────┴────────────┴────────────┴───────┴──────────────────────────┘
2 results found
```

### `summary` table output

```
┌───────────────┬────────────┬──────────────┬──────────┬─────────┬─────────┬───────┐
│ class         │ registered │ unregistered │ rejected │ partial │ unknown │ total │
├───────────────┼────────────┼──────────────┼──────────┼─────────┼─────────┼───────┤
│ Phone         │ 847        │ 12           │ 3        │ 0       │ 1       │ 863   │
│ Gateway       │ 14         │ 0            │ 0        │ 0       │ 0       │ 14    │
│ SIPTrunk      │ 22         │ 1            │ 0        │ 0       │ 0       │ 23    │
└───────────────┴────────────┴──────────────┴──────────┴─────────┴─────────┴───────┘
3 results found
```

---

## Audit Trail

Path: `~/.cisco-risport/audit.jsonl`
Rotation: 10MB → renamed to `audit.jsonl.1`

Each entry:

```json
{"timestamp":"2026-03-19T12:00:00.000Z","cluster":"10.0.0.1","command":"query","args":{"deviceClass":"Phone","status":"Any"},"duration_ms":342,"status":"success","results":863}
```

Disable per-command with `--no-audit`.

---

## File Structure

```
cisco-risport/
├── cli/
│   ├── index.js                    # Entry point: Commander program, update-notifier
│   ├── commands/
│   │   ├── config.js               # config add/use/list/show/remove/test
│   │   ├── query.js                # query (selectCmDevice / selectCmDeviceExt)
│   │   ├── cti.js                  # cti (selectCtiDevice)
│   │   ├── models.js               # models (returnModels)
│   │   ├── status-reasons.js       # status-reasons (returnStatusReasons)
│   │   └── summary.js              # summary (multi-class health dashboard)
│   ├── formatters/
│   │   ├── table.js                # cli-table3
│   │   ├── json.js                 # JSON.stringify
│   │   ├── toon.js                 # async import @toon-format/toon
│   │   └── csv.js                  # csv-stringify/sync
│   └── utils/
│       ├── config.js               # load/save config, ss-cli resolution
│       ├── connection.js           # resolveConfig (flags → env → file)
│       ├── audit.js                # append to audit.jsonl with rotation
│       └── output.js               # printResult, printError with hints
├── skills/
│   └── cisco-risport-cli/
│       └── SKILL.md                # Superpowers skill definition
├── test/
│   └── cli/
│       ├── config.test.js
│       ├── query.test.js
│       ├── cti.test.js
│       ├── models.test.js
│       ├── status-reasons.test.js
│       ├── summary.test.js
│       └── utils/
│           ├── config.test.js
│           ├── connection.test.js
│           ├── audit.test.js
│           └── output.test.js
├── main.js                         # Existing library entry point
├── main.mjs                        # Existing ESM wrapper
└── package.json                    # Add bin, dependencies
```

---

## package.json Changes

```json
{
  "bin": {
    "cisco-risport": "./cli/index.js"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "cli-table3": "^0.6.3",
    "@toon-format/toon": "^1.0.0",
    "csv-stringify": "^6.0.0",
    "update-notifier": "^7.0.0"
  }
}
```

---

## Feature Comparison

### vs. cisco-cucm-mcp RisPort Tools

The `cisco-cucm-mcp` package exposes 4 RisPort tools:

| MCP Tool | CLI Equivalent | Notes |
|---|---|---|
| `select_cm_device` | `cisco-risport query` | Full parity; CLI adds `--extended`, `--format`, pagination |
| `select_cm_device_by_ip` | `cisco-risport query --select-by IPV4Address` | Covered by `--select-by` flag |
| `select_cm_device_all` | `cisco-risport query --auto-page` | Covered by `--auto-page` flag |
| `select_cti_item` | `cisco-risport cti` | Full parity |
| — | `cisco-risport models` | New: model lookup table |
| — | `cisco-risport status-reasons` | New: status reason lookup |
| — | `cisco-risport summary` | New: cluster health dashboard |
| — | `cisco-risport config` | New: multi-cluster config management |

The CLI provides everything the MCP tools do, plus persistent config, multiple output formats, audit logging, and the `summary` dashboard.

### vs. cucm-cli `device status`

The `cucm-cli` `device status` command provides basic registration status for phones. Comparison:

| Feature | cucm-cli device status | cisco-risport CLI |
|---|---|---|
| Phone registration | Yes | Yes |
| Gateway/SIPTrunk status | No | Yes (`--device-class`) |
| CTI device/line status | No | Yes (`cti` command) |
| Extended fields | No | Yes (`--extended`) |
| Auto-pagination | No | Yes (`--auto-page`) |
| Batch large device lists | No | Yes (auto when > 1000 items) |
| Output formats | table only | table, json, toon, csv |
| Multi-cluster config | No | Yes |
| Audit logging | No | Yes |
| Cluster health summary | No | Yes (`summary` command) |
| Model/status reason lookup | No | Yes |

### Reusable Patterns from cisco-dime / cisco-axl

The following patterns are copied directly from `cisco-dime` with minimal modification:

| Pattern | Source File | Notes for cisco-risport |
|---|---|---|
| Commander program setup | `cisco-dime/cli/index.js` | Remove `--concurrency`; no version flag needed |
| `config.js` utility | `cisco-dime/cli/utils/config.js` | Change config dir to `~/.cisco-risport`; remove presets |
| `connection.js` utility | `cisco-dime/cli/utils/connection.js` | Identical; change error message tool name |
| `audit.js` utility | `cisco-dime/cli/utils/audit.js` | Identical; different config dir via `getConfigDir()` |
| `output.js` utility | `cisco-dime/cli/utils/output.js` | Update error hints for RisPort errors |
| All formatters | `cisco-dime/cli/formatters/` | Copy verbatim: table.js, json.js, toon.js, csv.js |
| `config.js` command | `cisco-dime/cli/commands/config.js` | Remove presets section; update tool name |
| update-notifier pattern | `cisco-dime/cli/index.js` | Copy async import pattern verbatim |

---

## Skills Definition

Path: `skills/cisco-risport-cli/SKILL.md`

The skill enables AI agents to:
- Query real-time device registration status
- Get cluster health summaries
- Manage multi-cluster configurations
- Look up model names and status reason codes

Trigger phrases: "check device registration", "risport query", "cluster health", "phone status", "cti devices", "device model", "status reason"

---

## Security Considerations

- Config file created with mode `0600`; config directory with `0700`
- Passwords masked in `config show` output
- `--insecure` sets `NODE_TLS_REJECT_UNAUTHORIZED=0` for the process lifetime; warn in output
- Secret Server placeholders resolved at runtime, never persisted resolved values
- Audit log contains host/command/args but never credentials

---

## Non-Goals (v1)

- No `--all-nodes` flag on `query` (RisPort70 is cluster-wide; node filter is `--node`)
- No watch/poll mode
- No download functionality (RisPort is query-only)
- No WebSocket/streaming output
