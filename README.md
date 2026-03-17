# Cisco RisPort Library

Simple library to pull Risport70 status from a Cisco CUCM via SOAP.

Risport70 information can be found at
[RisPort70 API Reference](https://developer.cisco.com/docs/sxml/#!risport70-api-reference).

## Installation

```bash
npm install cisco-risport
```

## Requirements

This package uses the built-in Fetch API of Node.js (introduced in Node v16.15.0). You may need to enable the experimental VM module. Warnings can be disabled with an optional environment variable.

If you are using self-signed certificates on Cisco VOS products, you may need to disable TLS verification. This makes TLS and HTTPS insecure. Please only do this in a lab environment.

Suggested environment variables:

```env
NODE_OPTIONS=--experimental-vm-modules
NODE_NO_WARNINGS=1
NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Usage

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

// Using positional arguments
service
  .selectCmDevice(
    "SelectCmDeviceExt", 1000, "Any", "", "Any", "", "Name", "", "Any", "Any"
  )
  .then((results) => {
    console.log("Results:", results);
  })
  .catch((error) => {
    console.log(error);
  });
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
service
  .selectCtiDevice(1000, "Line", "Any", "", "AppId", "", "", "")
  .then((results) => {
    console.log("SelectCtiDevice Results:", results);
  })
  .catch((error) => {
    console.log(error);
  });
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
| --- | --- | --- |
| `host` | string | CUCM hostname or IP |
| `username` | string | CUCM admin username |
| `password` | string | CUCM admin password |
| `options` | object | Optional. `{ cookie }` to pass an existing cookie |
| `retry` | boolean | Optional. Enable fetch-retry (default: false) |

### Methods

| Method | Description |
| --- | --- |
| `selectCmDevice()` | Query CM device status (positional or named params) |
| `selectCmDevicePaginated()` | Auto-paginate through all devices via StateInfo |
| `selectCmDeviceBatched()` | Auto-chunk large device lists into batched requests |
| `selectCtiDevice()` | Query CTI device/line status |
| `getCookie()` | Get the current session cookie |
| `setCookie(cookie)` | Set a session cookie |
| `returnModels()` | Get device model code-to-name mapping |
| `returnStatusReasons()` | Get status reason code-to-description mapping |

## Running Tests

```bash
npm run test
```

Note: Tests use Cisco's DevNet sandbox information. Find more information here: [Cisco DevNet](https://devnetsandbox.cisco.com/)
