---
name: cisco-risport-cli
description: Use when querying Cisco CUCM real-time device registration status via the cisco-risport CLI — phone registration, CTI status, SIP trunk health, and cluster summary dashboards.
license: MIT
metadata:
  author: sieteunoseis
  version: "1.0.0"
---

# cisco-risport CLI

CLI for querying Cisco CUCM real-time device registration status via RisPort70 SOAP API.

## Setup

Configure a cluster (one-time, interactive prompt for password — never pass credentials on the command line):

```bash
cisco-risport config add <name> --host <host> --username <user> --insecure
# You will be prompted securely for the password
cisco-risport config test
```

For Secret Server integration:

```bash
cisco-risport config add <name> --host '<ss:ID:host>' --username '<ss:ID:username>' --password '<ss:ID:password>' --insecure
```

Or use environment variables (set via your shell profile, a `.env` file, or a secrets manager — never hardcode credentials):

```bash
export CUCM_HOST=<host>
export CUCM_USERNAME=<user>
export CUCM_PASSWORD=<pass>
```

## Commands

### config — Manage cluster configurations

```bash
cisco-risport config add <name> --host <host> --username <user>
# You will be prompted securely for the password
cisco-risport config use <name>
cisco-risport config list
cisco-risport config show
cisco-risport config remove <name>
cisco-risport config test
```

### query — Query CM device registration status

```bash
cisco-risport query                                           # all devices
cisco-risport query --class Phone --status Registered         # registered phones
cisco-risport query --class SIPTrunk                          # SIP trunks
cisco-risport query --select-by Name --item SEP001122334455   # specific device
cisco-risport query --select-by DirNumber --item 1001         # by directory number
cisco-risport query --class Phone --model "Cisco 8845"        # by model
cisco-risport query --node cucm-pub --status UnRegistered     # unregistered on specific node
cisco-risport query --paginate                                # auto-paginate all results
cisco-risport query --no-ext                                  # use SelectCmDevice (per-node, may have duplicates)
```

Options: `--class`, `--status`, `--model`, `--select-by`, `--item`, `--protocol`, `--download-status`, `--node`, `--max`, `--paginate`, `--no-ext`

### cti — Query CTI device/line/provider status

```bash
cisco-risport cti                                             # all CTI providers
cisco-risport cti --class Device --status Open                # open CTI devices
cisco-risport cti --class Line                                # CTI lines
cisco-risport cti --select-by AppID --item "Cisco CTIManager" # by application
cisco-risport cti --device-name SEP001122334455               # by device name
cisco-risport cti --dir-number 1001                           # by directory number
```

Options: `--class`, `--status`, `--node`, `--select-by`, `--item`, `--device-name`, `--dir-number`, `--max`

### models — List device model ID-to-name mappings

```bash
cisco-risport models                      # all models
cisco-risport models --search 8845        # filter by name or ID
cisco-risport models --format json        # JSON output
```

### status-reasons — List status reason codes

```bash
cisco-risport status-reasons              # all reason codes
cisco-risport status-reasons --format json
```

### summary — Cluster health dashboard

```bash
cisco-risport summary                     # Phone, Gateway, SIPTrunk counts
cisco-risport summary --all-classes       # all 8 device classes
cisco-risport summary --node cucm-pub     # specific node only
cisco-risport summary --no-ext            # use SelectCmDevice (per-node, may have duplicates)
cisco-risport summary --format json       # JSON for scripting
```

### doctor — Configuration and connectivity health check

```bash
cisco-risport doctor                      # run all checks
cisco-risport doctor --insecure           # with TLS skip
```

Checks: active cluster config, RisPort API connectivity, node discovery, config file permissions, audit trail size.

## Common Workflows

### Check if a phone is registered

```bash
cisco-risport query --select-by Name --item SEP001122334455 --format json
```

### Check if a DN is active

```bash
cisco-risport query --select-by DirNumber --item 1001
```

### SIP trunk health

```bash
cisco-risport query --class SIPTrunk --format table
```

### Cluster health dashboard

```bash
cisco-risport summary --all-classes
```

### Find unregistered phones

```bash
cisco-risport query --class Phone --status UnRegistered
```

### Verify connectivity before scripting

```bash
cisco-risport doctor
```

### Export all registered phones to CSV

```bash
cisco-risport query --class Phone --status Registered --paginate --format csv > phones.csv
```

### Look up a status reason code

```bash
cisco-risport status-reasons --format json
```

## Output Formats

- `--format table` (default) — human-readable table
- `--format json` — for scripting/parsing
- `--format toon` — token-efficient for AI agents (recommended)
- `--format csv` — for spreadsheets

## Global Flags

- `--host <host>` — override CUCM hostname
- `--username <user>` — override CUCM username
- `--password <pass>` — override CUCM password
- `--cluster <name>` — use a specific named cluster
- `--insecure` — skip TLS certificate verification (required for self-signed certs)
- `--no-audit` — disable audit logging for this command
- `--debug` — enable debug logging
