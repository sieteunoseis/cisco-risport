// fetch-retry can also wrap Node.js's native fetch API implementation:
const fetch = require("fetch-retry")(global.fetch);
const util = require("util");
const Models = require("./lib/Model");
const statusReasons = require("./lib/statusReasons");
const parseString = require("xml2js").parseString;
const stripPrefix = require("xml2js").processors.stripPrefix;

/**
 * Cisco RisPort Service
 * This is a service class that uses fetch and promises to pull RisPort data from Cisco CUCM
 *
 *
 * @class risPortService
 */

var XML_ENVELOPE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
 <soapenv:Header/>
 <soapenv:Body>
    <soap:selectCmDevice>
       <soap:StateInfo></soap:StateInfo>
       <soap:CmSelectionCriteria>
          <soap:MaxReturnedDevices>%s</soap:MaxReturnedDevices>
          <soap:DeviceClass>%s</soap:DeviceClass>
          <soap:Model>%s</soap:Model>
          <soap:Status>%s</soap:Status>
          <soap:NodeName>%s</soap:NodeName>
          <soap:SelectBy>%s</soap:SelectBy>
          <soap:SelectItems>%s</soap:SelectItems>
          <soap:Protocol>%s</soap:Protocol>
          <soap:DownloadStatus>%s</soap:DownloadStatus>
       </soap:CmSelectionCriteria>
    </soap:selectCmDevice>
 </soapenv:Body>
 </soapenv:Envelope>`;

var XML_EXT_ENVELOPE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
 <soapenv:Header/>
 <soapenv:Body>
    <soap:selectCmDeviceExt>
       <soap:StateInfo></soap:StateInfo>
       <soap:CmSelectionCriteria>
          <soap:MaxReturnedDevices>%s</soap:MaxReturnedDevices>
          <soap:DeviceClass>%s</soap:DeviceClass>
          <soap:Model>%s</soap:Model>
          <soap:Status>%s</soap:Status>
          <soap:NodeName>%s</soap:NodeName>
          <soap:SelectBy>%s</soap:SelectBy>
          <soap:SelectItems>%s</soap:SelectItems>
          <soap:Protocol>%s</soap:Protocol>
          <soap:DownloadStatus>%s</soap:DownloadStatus>
       </soap:CmSelectionCriteria>
    </soap:selectCmDeviceExt>
 </soapenv:Body>
 </soapenv:Envelope>`;

var XML_CTI_ENVELOPE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
 <soapenv:Header/>
 <soapenv:Body>
    <soap:selectCtiItem>
       <soap:StateInfo></soap:StateInfo>
       <soap:CtiSelectionCriteria>
          <soap:MaxReturnedItems>%s</soap:MaxReturnedItems>
          <soap:CtiMgrClass>%s</soap:CtiMgrClass>
          <soap:Status>%s</soap:Status>
          <soap:NodeName>%s</soap:NodeName>
          <soap:SelectAppBy>%s</soap:SelectAppBy>
          <soap:AppItems>%s</soap:AppItems>
          <soap:DevNames>%s</soap:DevNames>
          <soap:DirNumbers>%s</soap:DirNumbers>
       </soap:CtiSelectionCriteria>
    </soap:selectCtiItem>
 </soapenv:Body>
 </soapenv:Envelope>`;

// Set up our promise results
var promiseResults = {
  cookie: "",
  results: "",
};

// Set up our error results
var errorResults = {
  message: "",
};

class risPortService {
  constructor(host, username, password, options) {
    this._OPTIONS = {
      retries: process.env.RISPORT_RETRIES ? parseInt(process.env.RISPORT_RETRIES) : 3,
      retryDelay: process.env.RISPORT_RETRIES_DELAY ? parseInt(process.env.RISPORT_RETRIES_DELAY) : 1000,
      retryOn: [503],
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(username + ":" + password).toString("base64"),
        "Content-Type": "text/xml;charset=UTF-8",
        Connection: "keep-alive",
      },
    };
    if (options) {
      this._OPTIONS.headers = Object.assign(this._OPTIONS.headers, options);
    }
    this._HOST = host;
  }

  /**
   * Post Fetch using Cisco RisPort API
   *
   * @selectCmDevice
   var service = new risPortService();
   service.selectCmDevice().then((success => {
        console.log(success);
      }))
   * @memberof risPortService
   * @param {('SelectCmDevice'|'SelectCmDeviceExt')} soapAction - The soap action to use
   * @param {number} maxReturnedDevices - The maximum number of devices to return. The maximum parameter value is 2000.
   * @param {('Any'|'Phone'|'Gateway'|'H323'|'Cti'|'VoiceMail'|'MediaResources'|'HuntList'|'SIPTrunk'|'Unknown')} deviceclass - The device class to query for real-time status.
   * @param {string|number} model - The model to search for or 255 for "any model". Alternatively, you can use the model name.
   * @param {('Any'|'Registered'|'UnRegistered'|'Rejected'|'PartiallyRegistered'|'Unknown')} status - The status to search for. If you do not specify a status, the system returns all devices that match the other criteria.
   * @param {string} node - The UC Manager node name to query. If no NodeName is given, all nodes in the cluster are queried.
   * @param {('Name'|'IPV4Address'|'IPV6Address'|'DirNumber'|'Description'|'SIPStatus')} selectBy - The select by to search for. If you do not specify a select by, the system returns all devices that match the other criteria.
   * @param {string|array} selectItem - An array of one or more item elements, which may include names, IP addresses, or directory numbers, depending on the SelectBy parameter. The item value can include a * to return wildcard matches. You can also pass a single item.
   * @param {('Any'|'SCCP'|'SIP'|'Unknown')} protocol - The protocol to search for. If you do not specify a protocol, the system returns all devices that match the other criteria.
   * @param {('Any'|'Upgrading'|'Successful'|'Failed'|'Unknown')} downloadStatus - The download status to search for. If you do not specify a download status, the system returns all devices that match the other criteria.
   * @returns {promise} returns a Promise of 
   */
  selectCmDevice(soapAction, maxReturnedDevices, deviceclass, model, status, node, selectBy, selectItem, protocol, downloadStatus) {
    var itemStr;
    var XML;
    var options = this._OPTIONS;
    options.SOAPAction = `http://schemas.cisco.com/ast/soap/action/#RisPort#${soapAction}`;
    var host = this._HOST;

    if (Array.isArray(selectItem)) {
      itemStr = selectItem.map((phoneName) => "<soap:item>" + "<soap:Item>" + phoneName + "</soap:Item>" + "</soap:item>");
    } else {
      itemStr = "<soap:item>" + "<soap:Item>" + selectItem + "</soap:Item>" + "</soap:item>";
    }

    // Let's check if the user gave us a numeric value. If not let's convert to model enum. If not found set to "Any".
    if (!Number.isInteger(model)) {
      model = Object.keys(Models).find((key) => Models[key] === model);
      if (!model) {
        model = 255;
      }
    }

    if (soapAction === "SelectCmDeviceExt") {
      XML = util.format(XML_EXT_ENVELOPE, maxReturnedDevices, deviceclass, model, status, node, selectBy, itemStr, protocol, downloadStatus);
    } else {
      XML = util.format(XML_ENVELOPE, maxReturnedDevices, deviceclass, model, status, node, selectBy, itemStr, protocol, downloadStatus);
    }

    var soapBody = Buffer.from(XML);
    options.body = soapBody;

    return new Promise((resolve, reject) => {
      // We fetch the API endpoint
      fetch(`https://${host}:8443/realtimeservice2/services/RISService70`, options)
        .then(async (response) => {
          var data = []; // create an array to save chunked data from server
          promiseResults.cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";
          // response.body is a ReadableStream
          const reader = response.body.getReader();
          for await (const chunk of readChunks(reader)) {
            data.push(Buffer.from(chunk));
          }
          var buffer = Buffer.concat(data); // create buffer of data
          let xmlOutput = buffer.toString("binary").trim();
          let output = await parseXml(xmlOutput);
          // Remove unnecessary keys
          removeKeys(output, "$");
          if (keyExists(output, "SelectCmDeviceResult")) {
            var returnResults = output.Body.selectCmDeviceResponse.selectCmDeviceReturn.SelectCmDeviceResult.CmNodes.item;
            if (returnResults) {
              promiseResults.results = clean(returnResults);
              resolve(promiseResults);
            }else{
              // No results found
              resolve(promiseResults);
            }
          } else {
            // Error checking. If the response contains a fault, we return the fault.
            if (keyExists(output, "Fault")) {
              if (output.Body.Fault.faultcode.includes("RateControl")) {
                errorResults.message = { faultcode: "RateControl", faultstring: output.Body.Fault.faultstring };
              } else if (output.Body.Fault.faultcode.includes("generalException")) {
                errorResults.message = { faultcode: "generalException", faultstring: output.Body.Fault.faultstring };
              } else {
                errorResults.message = { faultcode: output.Body.Fault.faultcode, faultstring: output.Body.Fault.faultstring };
              }
              reject(errorResults);
            } else {
              // Error unknown. Reject with the response status instead. Most likely a 500 error from the server.
              errorResults.message = response.status;
              reject(errorResults);
            }
          }
        })
        .catch((error) => {
          reject(error);
        }); // catches the error and logs it
    });
  }
  /**
   * Post Fetch using Cisco RisPort API
   *
   * @selectCtiDevice
   var service = new risPortService();
   service.selectCtiDevice().then((success => {
        console.log(success);
      }))
   * @memberof risPortService
   * @returns {promise} returns a Promise
   */
  selectCtiDevice(maxReturnedDevices, ctiMgrClass, status, node, selectAppBy, appItem, devName, dirNumber) {
    var appItemsStr;
    var devNamesStr;
    var dirNumbersStr;
    var XML;
    var options = this._OPTIONS;
    options.SOAPAction = `http://schemas.cisco.com/ast/soap/action/#RisPort#SelectCtiItem`;
    var host = this._HOST;

    if (Array.isArray(appItem)) {
      appItemsStr = appItem.map((item) => "<soap:item>" + "<soap:AppItem>" + item + "</soap:AppItem>" + "</soap:item>");
    } else {
      appItemsStr = "<soap:item>" + "<soap:AppItem>" + appItem + "</soap:AppItem>" + "</soap:item>";
    }

    if (Array.isArray(devName)) {
      devNamesStr = appItem.map((item) => "<soap:item>" + "<soap:DevName>" + item + "</soap:DevName>" + "</soap:item>");
    } else {
      devNamesStr = "<soap:item>" + "<soap:DevName>" + devName + "</soap:DevName>" + "</soap:item>";
    }

    if (Array.isArray(dirNumber)) {
      dirNumbersStr = dirNumber.map((item) => "<soap:item>" + "<soap:DirNumber>" + item + "</soap:DirNumber>" + "</soap:item>");
    } else {
      dirNumbersStr = "<soap:item>" + "<soap:DirNumber>" + dirNumber + "</soap:DirNumber>" + "</soap:item>";
    }

    XML = util.format(XML_CTI_ENVELOPE, maxReturnedDevices, ctiMgrClass, status, node, selectAppBy, appItemsStr, devNamesStr, dirNumbersStr);

    var soapBody = Buffer.from(XML);
    options.body = soapBody;

    return new Promise((resolve, reject) => {
      // We fetch the API endpoint
      fetch(`https://${host}:8443/realtimeservice2/services/RISService70`, options)
        .then(async (response) => {
          var data = []; // create an array to save chunked data from server
          promiseResults.cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";
          // response.body is a ReadableStream
          const reader = response.body.getReader();
          for await (const chunk of readChunks(reader)) {
            data.push(Buffer.from(chunk));
          }
          var buffer = Buffer.concat(data); // create buffer of data
          let xmlOutput = buffer.toString("binary").trim();
          let output = await parseXml(xmlOutput);
          // Remove unnecessary keys
          removeKeys(output, "$");
          if (keyExists(output, "SelectCtiItemResult")) {
            var returnResults = output.Body.selectCtiItemResponse.selectCtiItemReturn.SelectCtiItemResult.CtiNodes.item;
            if (returnResults) {
              promiseResults.results = clean(returnResults);
              resolve(promiseResults);
            } else {
              // No results found
              resolve(promiseResults);
            }
          } else {
            // Error checking. If the response contains a fault, we return the fault.
            if (keyExists(output, "Fault")) {
              if (output.Body.Fault.faultcode.includes("RateControl")) {
                errorResults.message = { faultcode: "RateControl", faultstring: output.Body.Fault.faultstring };
              } else if (output.Body.Fault.faultcode.includes("generalException")) {
                errorResults.message = { faultcode: "generalException", faultstring: output.Body.Fault.faultstring };
              } else {
                errorResults.message = { faultcode: output.Body.Fault.faultcode, faultstring: output.Body.Fault.faultstring };
              }
              reject(errorResults);
            } else {
              // Error unknown. Reject with the response status instead. Most likely a 500 error from the server.
              errorResults.message = response.status;
              reject(errorResults);
            }
          }
        })
        .catch((error) => {
          reject(error);
        }); // catches the error and logs it
    });
  }
  returnModels() {
    return Models;
  }
  returnStatusReasons() {
    return statusReasons;
  }
}

// readChunks() reads from the provided reader and yields the results into an async iterable
const readChunks = (reader) => {
  return {
    async *[Symbol.asyncIterator]() {
      let readResult = await reader.read();
      while (!readResult.done) {
        yield readResult.value;
        readResult = await reader.read();
      }
    },
  };
};

const keyExists = (obj, key) => {
  if (!obj || (typeof obj !== "object" && !Array.isArray(obj))) {
    return false;
  } else if (obj.hasOwnProperty(key)) {
    return true;
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = keyExists(obj[i], key);
      if (result) {
        return result;
      }
    }
  } else {
    for (const k in obj) {
      const result = keyExists(obj[k], key);
      if (result) {
        return result;
      }
    }
  }

  return false;
};

/**
 * Remove all specified keys from an object, no matter how deep they are.
 * The removal is done in place, so run it on a copy if you don't want to modify the original object.
 * This function has no limit so circular objects will probably crash the browser
 *
 * @param obj The object from where you want to remove the keys
 * @param keys An array of property names (strings) to remove
 */
const removeKeys = (obj, keys) => {
  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      switch (typeof obj[prop]) {
        case "object":
          if (keys.indexOf(prop) > -1) {
            delete obj[prop];
          } else {
            removeKeys(obj[prop], keys);
          }
          break;
        default:
          if (keys.indexOf(prop) > -1) {
            delete obj[prop];
          }
          break;
      }
    }
  }
};

const clean = (object) => {
  Object.entries(object).forEach(([k, v]) => {
    if (v && typeof v === "object") {
      clean(v);
    }
    if ((v && typeof v === "object" && !Object.keys(v).length) || v === null || v === undefined) {
      if (Array.isArray(object)) {
        object.splice(k, 1);
      } else {
        delete object[k];
      }
    }
  });
  return object;
};

const parseXml = (xmlPart) => {
  return new Promise((resolve, reject) => {
    parseString(
      xmlPart,
      {
        explicitArray: false,
        explicitRoot: false,
        tagNameProcessors: [stripPrefix],
      },
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }
    );
  });
};

module.exports = risPortService;
