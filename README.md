# cisco-risport

[![npm](https://img.shields.io/npm/v/cisco-risport)](https://www.npmjs.com/package/cisco-risport)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Skills.sh](https://img.shields.io/badge/skills.sh-cisco--risport--cli-blue)](https://skills.sh/sieteunoseis/cisco-risport/cisco-risport-cli)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-orange?logo=buy-me-a-coffee)](https://buymeacoffee.com/automatebldrs)

Library and CLI for querying Cisco CUCM real-time device registration status via the RisPort70 SOAP API.

RisPort70 information can be found at the [RisPort70 API Reference](https://developer.cisco.com/docs/sxml/#!risport70-api-reference).

## Installation

### CLI (global)

```bash
npm install -g cisco-risport
```

### Library

```bash
npm install cisco-risport
```

## Quick Start

```bash
# Configure a cluster
cisco-risport config add lab --host 10.10.20.1 --username admin --password secret --insecure

# Verify connectivity
cisco-risport doctor

# Query all registered phones
cisco-risport query --class Phone --status Registered

# Cluster health dashboard
cisco-risport summary

# Check a specific device
cisco-risport query --select-by Name --item SEP001122334455

# SIP trunk status
cisco-risport query --class SIPTrunk
```

## CLI Commands

### config — Manage CUCM cluster configurations

```bash
cisco-risport config add <name> --host <host> --username <user> --password <pass>
cisco-risport config use <name>          # switch active cluster
cisco-risport config list                # list all clusters
cisco-risport config show                # show active cluster details
cisco-risport config remove <name>       # remove a cluster
cisco-risport config test                # test connection to active cluster
```

Supports Secret Server integration for secure credential storage:

```bash
cisco-risport config add <name> --host '<ss:ID:host>' --username '<ss:ID:username>' --password '<ss:ID:password>'
```

Or use environment variables:

```bash
export CUCM_HOST=<host>
export CUCM_USERNAME=<user>
export CUCM_PASSWORD=<pass>
```

Credential resolution order: CLI flags > environment variables > config file.

### query — Query CM device registration status

```bash
cisco-risport query                                           # all devices
cisco-risport query --class Phone --status Registered         # registered phones
cisco-risport query --class SIPTrunk                          # SIP trunks
cisco-risport query --select-by Name --item SEP001122334455   # specific device
cisco-risport query --select-by DirNumber --item 1001         # by directory number
cisco-risport query --class Phone --model "Cisco 8845"        # by model
cisco-risport query --node cucm-pub --status UnRegistered     # unregistered on a node
cisco-risport query --paginate                                # auto-paginate all results
cisco-risport query --ext                                     # use SelectCmDeviceExt
```

| Option | Description | Default |
|---|---|---|
| `--class <class>` | Any, Phone, Gateway, H323, Cti, VoiceMail, MediaResources, HuntList, SIPTrunk, Unknown | Any |
| `--status <status>` | Any, Registered, UnRegistered, Rejected, PartiallyRegistered, Unknown | Any |
| `--model <id>` | Model number or name (255 = any) | 255 |
| `--select-by <field>` | Name, IPV4Address, IPV6Address, DirNumber, Description, SIPStatus | |
| `--item <value>` | Single or comma-separated items (used with --select-by) | |
| `--protocol <proto>` | Any, SCCP, SIP, Unknown | Any |
| `--download-status <status>` | Any, Upgrading, Successful, Failed, Unknown | Any |
| `--node <name>` | Filter to a specific CUCM node | |
| `--max <n>` | Maximum results per page | 1000 |
| `--paginate` | Auto-paginate through all results using StateInfo | |
| `--ext` | Use SelectCmDeviceExt instead of SelectCmDevice | |

### cti — Query CTI device/line/provider status

```bash
cisco-risport cti                                             # all CTI providers
cisco-risport cti --class Device --status Open                # open CTI devices
cisco-risport cti --class Line                                # CTI lines
cisco-risport cti --select-by AppID --item "Cisco CTIManager" # by application
```

| Option | Description | Default |
|---|---|---|
| `--class <class>` | Provider, Device, Line | Provider |
| `--status <status>` | Open, Closed, Any | Any |
| `--node <name>` | Filter to a specific CUCM node | |
| `--select-by <field>` | AppName, AppID, UserID | |
| `--item <value>` | Application name/ID or user ID to filter on | |
| `--device-name <name>` | Device name filter (comma-separated for multiple) | |
| `--dir-number <number>` | Directory number filter (comma-separated for multiple) | |
| `--max <n>` | Maximum results | 1000 |

### models — List device model ID-to-name mappings

```bash
cisco-risport models                      # all models
cisco-risport models --search 8845        # filter by name or ID
```

### status-reasons — List status reason code descriptions

```bash
cisco-risport status-reasons
```

### summary — Cluster health dashboard

```bash
cisco-risport summary                     # Phone, Gateway, SIPTrunk counts
cisco-risport summary --all-classes       # all 8 device classes
cisco-risport summary --node cucm-pub     # specific node
cisco-risport summary --format json       # JSON for scripting
```

### doctor — Configuration and connectivity health check

```bash
cisco-risport doctor
```

Checks active cluster configuration, RisPort API connectivity, node discovery, config file permissions, and audit trail status.

## Global Flags

| Flag | Description |
|---|---|
| `--format <type>` | Output format: table (default), json, toon, csv |
| `--host <host>` | Override CUCM hostname |
| `--username <user>` | Override CUCM username |
| `--password <pass>` | Override CUCM password |
| `--cluster <name>` | Use a specific named cluster |
| `--insecure` | Skip TLS certificate verification |
| `--no-audit` | Disable audit logging |
| `--debug` | Enable debug logging |

## Output Formats

- **table** (default) — human-readable table with row counts
- **json** — pretty-printed JSON for scripting and parsing
- **csv** — comma-separated values for spreadsheets
- **toon** — token-efficient format for AI agents (recommended for LLM pipelines)

## Library Usage

### CommonJS

```javascript
const RisPortService = require("cisco-risport");
```

### ESM

```javascript
import RisPortService from "cisco-risport";
```

### TypeScript

TypeScript declarations are included out of the box.

```typescript
import RisPortService from "cisco-risport";
```

### Basic Example

```javascript
const RisPortService = require("cisco-risport");

const service = new RisPortService("10.10.20.1", "administrator", "ciscopsdt");

const result = await service.selectCmDevice(
  "SelectCmDeviceExt", 1000, "Any", "", "Any", "", "Name", "", "Any", "Any"
);
console.log("Results:", result);
```

### Named Parameters (v1.4.0+)

```javascript
const results = await service.selectCmDevice({
  action: "SelectCmDeviceExt",
  maxReturned: 1000,
  deviceClass: "Phone",
  status: "Registered",
  selectBy: "Name",
  selectItems: ["SEP001122334455", "SEP556677889900"],
});
```

### Batched Requests

Automatically chunk large device lists into smaller requests:

```javascript
const results = await service.selectCmDeviceBatched(
  "SelectCmDeviceExt",
  { maxReturned: 1000, deviceClass: "Phone", selectBy: "Name" },
  largeDeviceList,
  {
    chunkSize: 200,
    delayMs: 100,
    onProgress: (batch, total) => console.log(`Batch ${batch}/${total}`),
  }
);
```

### Paginated Requests

Fetch all devices using CUCM's StateInfo pagination:

```javascript
const results = await service.selectCmDevicePaginated({
  action: "SelectCmDeviceExt",
  maxReturned: 1000,
  deviceClass: "Phone",
  status: "Any",
  selectBy: "Name",
});
```

### CTI Device Query

```javascript
const result = await service.selectCtiDevice(1000, "Line", "Any", "", "AppId", "", "", "");
console.log("SelectCtiDevice Results:", result);
```

### Cookie Management

Reuse cookies across requests or instances:

```javascript
const service = new RisPortService("10.10.20.1", "admin", "password");

// After a request, the cookie is auto-captured
await service.selectCmDevice({ action: "SelectCmDeviceExt", maxReturned: 100 });
const cookie = service.getCookie();

// Pass cookie to a new instance
const service2 = new RisPortService("10.10.20.1", "admin", "password", { cookie });
```

### Utility Methods

```javascript
// Get all device model codes and names
const models = service.returnModels();

// Get all status reason codes and descriptions
const reasons = service.returnStatusReasons();
```

## API Reference

### Constructor

```javascript
new RisPortService(host, username, password, options?, retry?)
```

| Parameter | Type | Description |
|---|---|---|
| `host` | string | CUCM hostname or IP |
| `username` | string | CUCM admin username |
| `password` | string | CUCM admin password |
| `options` | object | Optional. `{ cookie }` to pass an existing cookie |
| `retry` | boolean | Optional. Enable fetch-retry (default: false) |

### Methods

| Method | Description |
|---|---|
| `selectCmDevice()` | Query CM device status (positional or named params) |
| `selectCmDevicePaginated()` | Auto-paginate through all devices via StateInfo |
| `selectCmDeviceBatched()` | Auto-chunk large device lists into batched requests |
| `selectCtiDevice()` | Query CTI device/line status |
| `getCookie()` | Get the current session cookie |
| `setCookie(cookie)` | Set a session cookie |
| `returnModels()` | Get device model code-to-name mapping |
| `returnStatusReasons()` | Get status reason code-to-description mapping |

## Requirements

This package uses the built-in Fetch API of Node.js (introduced in Node v16.15.0). You may need to enable the experimental VM module. Warnings can be disabled with an optional environment variable.

If you are using self-signed certificates on Cisco VOS products, you may need to disable TLS verification. This makes TLS and HTTPS insecure. Please only do this in a lab environment.

Suggested environment variables:

```env
NODE_OPTIONS=--experimental-vm-modules
NODE_NO_WARNINGS=1
NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Running Tests

```bash
node test/unit.js
```

## Related Tools

| Tool | Purpose |
|---|---|
| [cisco-axl](https://github.com/sieteunoseis/cisco-axl) | CUCM configuration via AXL |
| [cisco-dime](https://github.com/sieteunoseis/cisco-dime) | CUCM log collection via DIME |
| [cisco-ise](https://github.com/sieteunoseis/cisco-ise) | ISE endpoint and session management |
| [cisco-support](https://github.com/sieteunoseis/cisco-support) | Cisco Support APIs (bugs, cases, EoX, PSIRT) |
| [cisco-uc-engineer](https://github.com/sieteunoseis/cisco-uc-engineer) | UC troubleshooting orchestration |

## Funding

If you find this tool helpful, consider supporting development:

[![Buy Me A Coffee](https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=automatebldrs&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff)](https://buymeacoffee.com/automatebldrs)

## License

MIT
