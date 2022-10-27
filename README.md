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

In Node.js:

```javascript
const ciscoRisport = require("cisco-risport");

// Default login information for Cisco DevNet
var server = {
  hostname: "10.10.20.1",
  username: "administrator",
  password: "ciscopsdt",
};

// This method allows clients to perform Cisco Unified CM device-related queries. 
(async () => {
  let output = await ciscoRisPort
    .selectCmDevice(
      server.hostname,
      server.username,
      server.password,
      "SelectCmDeviceExt", // Either SelectCmDevice or SelectCmDeviceExt
      1000, // The maximum number of devices to return. The maximum parameter value is 1000.
      "Any", // Device Class (Any, Phone, Gateway, H323, Cti, VoiceMail, MediaResources, HuntList, SIPTrunk, Unknown)
      255, // Model Enum. Use 255 for "any model". Can use a string of model name and it will convert it to the enum (Example "SIP Trunk").
      "Any", // Status (Any, Registered, UnRegistered, Rejected, PartiallyRegistered, Unknown)
      "Name", // Select By (Name, IPV4Address, IPV6Address, DirNumber, Description, SIPStatus)
      "SEPE8B7480316D6", // Select Items. Can either be a single item string or an array of items. May include names, IP addresses, or directory numbers or * to return wildcard matches.
      "Any", // Protocol (Any, SCCP, SIP, Unknown)
      "Any" // Download Status (Any, Upgrading, Successful, Failed, Unknown)
    )
    .catch((err) => {
      console.log(err);
      return false;
    });
  console.log(JSON.stringify(output));
})();

// This method allows clients to perform CTI manager related queries.
(async () => {
  let output = await ciscoRisPort
    .selectCtiDevice(
      server.hostname,
      server.username,
      server.password,
      1000, // The maximum number of devices to return. The maximum parameter value is 1000.
      "Line", // A search is requested on Provider, Device, or Line.
      "Any", // Status (Any, Open, Closed, OpenFailed, Unknown)
      "AppId", // Select by (AppId, AppIPV4Address, AppIPV6Address, UserId)
      "cucmuser-192.168.168.169-4963", // AppItems. String representing a unique CTI application connection defined by the Select by
      "SEPF01FAF38ABC2", // List of devices controlled by the CTI application(s).
      "4000" // List of directory numbers controlled by the CTI application(s). Note: DirNumber lookup only works if specifying "Line" in the soap:CtiMgrClass tag.
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