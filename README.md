# Cisco RisPort Library

Simple library to pull Risport70 status from a Cisco CUCM via SOAP.

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

```javascript
const risPortService = require("../main");

let service = new risPortService("10.10.20.1", "administrator", "ciscopsdt");

service
  .selectCmDevice(
    "SelectCmDeviceExt",1000,"Any","","Any","","Name","","Any","Any")
  .then((results) => {
    console.log("SelectCmDeviceExt Results:", "\n", results);
  })
  .catch((error) => {
    console.log(error);
  });

service
  .selectCtiDevice(1000, "Line", "Any", "", "AppId", "", "", "")
  .then((results) => {
    console.log("SelectCtiDevice Results:", "\n", results);
  })
  .catch((error) => {
    console.log(error);
  });
```

## Examples

```javascript
npm run test
```

Note: Test are using Cisco's DevNet sandbox information. Find more information here: [Cisco DevNet](https://devnetsandbox.cisco.com/)