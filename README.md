# Cisco DIME Library

Simple library to pull Risport70 status from a Cisco UC Products (VOS) via SOAP.

Risport70 information can be found at
[RisPort70 API Reference](https://developer.cisco.com/docs/sxml/#!risport70-api-reference).

## Installation

Using npm:

```javascript
npm i -g npm
npm i --save cisco-risport
```

## Requirements

This package uses the built in Fetch API of Node. This feature was first introduced in Node v16.15.0. You may need to enable expermential vm module. Also you can disable warnings with an optional enviromental variable.

Also if you are using self signed certificates on Cisco VOS products you may need to disable TLS verification. This makes TLS, and HTTPS by extension, insecure. The use of this environment variable is strongly discouraged. Please only do this in a lab enviroment.

Suggested enviromental variables:

```env
NODE_OPTIONS=--experimental-vm-modules
NODE_NO_WARNINGS=1
NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Usage

In Node.js:

```javascript
const ciscoRisport = require("cisco-risport");

// Default login information for Cisco DevNet
var server = {
  hostname: "10.10.20.1",
  username: "administrator",
  password: "ciscopsdt",
};

(async () => {
  let output = await ciscoRisPort
    .selectCmDevice(
      server.hostname,
      server.username,
      server.password,
      "SelectCmDeviceExt",
      "1000",
      "Any",
      "131",
      "Any",
      "Name",
      "",
      "Any",
      "Any"
    )
    .catch((err) => {
      console.log(err);
      return false;
    });
  console.log(JSON.stringify(output));
})();

(async () => {
  let output = await ciscoRisPort
    .selectCtiDevice(
      server.hostname,
      server.username,
      server.password,
      "1000",
      "Line",
      "Any",
      "AppId",
      "",
      "",
      ""
    )
    .catch((err) => {
      console.log(err);
      return false;
    });
  console.log(JSON.stringify(output));
})();
```

## Examples

```javascript
npm run test
```

Note: Test are using Cisco's DevNet sandbox information. Find more information here: [Cisco DevNet](https://devnetsandbox.cisco.com/)