var util = require("util");
const Models = require("./Model");

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
         <soap:NodeName></soap:NodeName>
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
         <soap:NodeName></soap:NodeName>
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
         <soap:NodeName></soap:NodeName>
         <soap:SelectAppBy>%s</soap:SelectAppBy>
         <soap:AppItems>%s</soap:AppItems>
         <soap:DevNames>%s</soap:DevNames>
         <soap:DirNumbers>%s</soap:DirNumbers>
      </soap:CtiSelectionCriteria>
   </soap:selectCtiItem>
</soapenv:Body>
</soapenv:Envelope>`;

class ucSoapSelectSession {
  constructor(ucUser, ucPassword) {
    this._OPTIONS = {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(ucUser + ":" + ucPassword).toString("base64"),
        "Content-Type": "text/xml;charset=UTF-8",
      },
    };
  }
  async selectCmDevice(
    host,
    soapAction,
    maxReturnedDevices,
    deviceclass,
    model,
    status,
    selectBy,
    selectItem,
    protocol,
    downloadStatus,
    callback
  ) {
    var itemStr;
    var XML;
    var options = this._OPTIONS;

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
    if(!Number.isInteger(model)){
      model = Object.keys(Models).find(key => Models[key] === model);
      if(!model){
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
        selectBy,
        itemStr,
        protocol,
        downloadStatus
      );
    }

    options.SOAPAction = `http://schemas.cisco.com/ast/soap/action/#RisPort#${soapAction}`;
    var soapBody = Buffer.from(XML);
    options.body = soapBody;

    fetch(
      `https://${host}:8443/realtimeservice2/services/RISService70`,
      options
    )
      .then(handleError) // skips to .catch if error is thrown
      .then(async (response) => {
        var data = []; // create an array to save chunked data from server
        // response.body is a ReadableStream
        const reader = response.body.getReader();
        for await (const chunk of readChunks(reader)) {
          data.push(Buffer.from(chunk));
        }
        var buffer = Buffer.concat(data); // create buffer of data
        let xmlOutput = buffer.toString("binary").trim();
        // console.log(xmlOutput);
        callback(null, xmlOutput); // call back buffer
      })
      .catch((error) => {
        callback(error.cause, null);
      }); // catches the error and logs it
  }
  async selectCtiItem(
    host,
    maxReturnedDevices,
    ctiMgrClass,
    status,
    selectAppBy,
    appItem,
    devName,
    dirNumber,
    callback
  ) {
    var appItemsStr;
    var devNamesStr;
    var dirNumbersStr;
    var XML;

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

    var options = this._OPTIONS;
    XML = util.format(
      XML_CTI_ENVELOPE,
      maxReturnedDevices,
      ctiMgrClass,
      status,
      selectAppBy,
      appItemsStr,
      devNamesStr,
      dirNumbersStr
    );

    options.SOAPAction = `http://schemas.cisco.com/ast/soap/action/#RisPort#SelectCtiItem`;
    var soapBody = Buffer.from(XML);
    options.body = soapBody;

    fetch(
      `https://${host}:8443/realtimeservice2/services/RISService70`,
      options
    )
      .then(handleError) // skips to .catch if error is thrown
      .then(async (response) => {
        var data = []; // create an array to save chunked data from server
        // response.body is a ReadableStream
        const reader = response.body.getReader();
        for await (const chunk of readChunks(reader)) {
          data.push(Buffer.from(chunk));
        }
        var buffer = Buffer.concat(data); // create buffer of data
        let xmlOutput = buffer.toString("binary").trim();
        // console.log(xmlOutput);
        callback(null, xmlOutput); // call back buffer
      })
      .catch((error) => {
        callback(error.cause, null);
      }); // catches the error and logs it
  }
}

const handleError = (response) => {
  if (!response.ok) {
    throw Error(response.statusText);
  } else {
    return response;
  }
}; //handler function that throws any encountered error

// readChunks() reads from the provided reader and yields the results into an async iterable
function readChunks(reader) {
  return {
    async *[Symbol.asyncIterator]() {
      let readResult = await reader.read();
      while (!readResult.done) {
        yield readResult.value;
        readResult = await reader.read();
      }
    },
  };
}

module.exports = {
  service: function (ucUser, ucPassword) {
    return new ucSoapSelectSession(ucUser, ucPassword);
  },
};
