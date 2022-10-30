const util = require("util");
const Models = require("./lib/Model");
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

class risPortService {
  constructor(host, username, password) {
    this._OPTIONS = {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(username + ":" + password).toString("base64"),
        "Content-Type": "text/xml;charset=UTF-8",
      },
    };
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
   * @returns {promise} returns a Promise
   */
  selectCmDevice(
    soapAction,
    maxReturnedDevices,
    deviceclass,
    model,
    status,
    node,
    selectBy,
    selectItem,
    protocol,
    downloadStatus
  ) {
    var itemStr;
    var XML;
    var options = this._OPTIONS;
    options.SOAPAction = `http://schemas.cisco.com/ast/soap/action/#RisPort#${soapAction}`;
    var host = this._HOST;

    if (Array.isArray(selectItem)) {
      itemStr = selectItem.map(
        (phoneName) =>
          "<soap:item>" +
          "<soap:Item>" +
          phoneName +
          "</soap:Item>" +
          "</soap:item>"
      );
    } else {
      itemStr =
        "<soap:item>" +
        "<soap:Item>" +
        selectItem +
        "</soap:Item>" +
        "</soap:item>";
    }

    // Let's check if the user gave us a numeric value. If not let's convert to model enum. If not found set to "Any".
    if (!Number.isInteger(model)) {
      model = Object.keys(Models).find((key) => Models[key] === model);
      if (!model) {
        model = 255;
      }
    }

    if (soapAction === "SelectCmDeviceExt") {
      XML = util.format(
        XML_EXT_ENVELOPE,
        maxReturnedDevices,
        deviceclass,
        model,
        status,
        node,
        selectBy,
        itemStr,
        protocol,
        downloadStatus
      );
    } else {
      XML = util.format(
        XML_ENVELOPE,
        maxReturnedDevices,
        deviceclass,
        model,
        status,
        node,
        selectBy,
        itemStr,
        protocol,
        downloadStatus
      );
    }

    var soapBody = Buffer.from(XML);
    options.body = soapBody;

    return new Promise((resolve, reject) => {
      // We fetch the API endpoint
      fetch(
        `https://${host}:8443/realtimeservice2/services/RISService70`,
        options
      )
        .then(async (response) => {
          var data = []; // create an array to save chunked data from server
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
            var returnResults =
              output.Body.selectCmDeviceResponse.selectCmDeviceReturn
                .SelectCmDeviceResult.CmNodes.item;
            if (returnResults) {
              resolve(clean(returnResults));
            } else {
              reject(output.Body.Fault);
            }
          }else{
            reject({"response":"empty"});
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
  selectCtiDevice(
    maxReturnedDevices,
    ctiMgrClass,
    status,
    node,
    selectAppBy,
    appItem,
    devName,
    dirNumber
  ) {
    var appItemsStr;
    var devNamesStr;
    var dirNumbersStr;
    var XML;
    var options = this._OPTIONS;
    options.SOAPAction = `http://schemas.cisco.com/ast/soap/action/#RisPort#SelectCtiItem`;
    var host = this._HOST;

    if (Array.isArray(appItem)) {
      appItemsStr = appItem.map(
        (item) =>
          "<soap:item>" +
          "<soap:AppItem>" +
          item +
          "</soap:AppItem>" +
          "</soap:item>"
      );
    } else {
      appItemsStr =
        "<soap:item>" +
        "<soap:AppItem>" +
        appItem +
        "</soap:AppItem>" +
        "</soap:item>";
    }

    if (Array.isArray(devName)) {
      devNamesStr = appItem.map(
        (item) =>
          "<soap:item>" +
          "<soap:DevName>" +
          item +
          "</soap:DevName>" +
          "</soap:item>"
      );
    } else {
      devNamesStr =
        "<soap:item>" +
        "<soap:DevName>" +
        devName +
        "</soap:DevName>" +
        "</soap:item>";
    }

    if (Array.isArray(dirNumber)) {
      dirNumbersStr = dirNumber.map(
        (item) =>
          "<soap:item>" +
          "<soap:DirNumber>" +
          item +
          "</soap:DirNumber>" +
          "</soap:item>"
      );
    } else {
      dirNumbersStr =
        "<soap:item>" +
        "<soap:DirNumber>" +
        dirNumber +
        "</soap:DirNumber>" +
        "</soap:item>";
    }

    XML = util.format(
      XML_CTI_ENVELOPE,
      maxReturnedDevices,
      ctiMgrClass,
      status,
      node,
      selectAppBy,
      appItemsStr,
      devNamesStr,
      dirNumbersStr
    );

    var soapBody = Buffer.from(XML);
    options.body = soapBody;

    return new Promise((resolve, reject) => {
      // We fetch the API endpoint
      fetch(
        `https://${host}:8443/realtimeservice2/services/RISService70`,
        options
      )
        .then(async (response) => {
          var data = []; // create an array to save chunked data from server
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
            var returnResults =
              output.Body.selectCtiItemResponse.selectCtiItemReturn
                .SelectCtiItemResult.CtiNodes.item;
            if (returnResults) {
              resolve(clean(returnResults));
            } else {
              reject({"response":"empty"});
            }
          } else {
            reject(output.Body.Fault);
          }
        })
        .catch((error) => {
          reject(error);
        }); // catches the error and logs it
    });
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
    if (
      (v && typeof v === "object" && !Object.keys(v).length) ||
      v === null ||
      v === undefined
    ) {
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
