var risport70 = require("./lib/Risport70");
var parseString = require("xml2js").parseString;
var stripPrefix = require("xml2js").processors.stripPrefix;

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
function removeKeys(obj, keys) {
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
}

function clean(object) {
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
}

function parseXml(xmlPart) {
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
}

module.exports = {
  selectCmDevice: function (
    host,
    username,
    password,
    soapAction,
    maxReturnedDevices,
    deviceclass,
    model,
    status,
    selectBy,
    selectItem,
    protocol,
    downloadStatus
  ) {
    return new Promise((resolve, reject) => {
      // Let's get our DIME set up service
      let risportService = risport70.service(username, password);
      risportService.selectCmDevice(
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
        async function (err, response) {
          if (err) {
            reject("Error: " + err);
          }
          if (response) {
            let output = await parseXml(response);
            if (keyExists(output, "SelectCmDeviceResult")) {
              var returnResults =
                output.Body.selectCmDeviceResponse.selectCmDeviceReturn
                  .SelectCmDeviceResult.CmNodes.item;
              if(returnResults){
                removeKeys(returnResults, "$");
                resolve(clean(returnResults));
              }else{
                reject("Response empty");
              }
            }
          } else {
            reject("Response empty");
          }
        }
      );
    });
  },
  selectCtiDevice: function (
    host,
    username,
    password,
    maxReturnedDevices,
    ctiMgrClass,
    status,
    selectAppBy,
    appItem,
    devName,
    dirNumber
  ) {
    return new Promise((resolve, reject) => {
      // Let's get our DIME set up service
      let risportService = risport70.service(username, password);
      risportService.selectCtiItem(
        host,
        maxReturnedDevices,
        ctiMgrClass,
        status,
        selectAppBy,
        appItem,
        devName,
        dirNumber,
        async function (err, response) {
          if (err) {
            reject("Error: " + err);
          }
          if (response) {
            let output = await parseXml(response);
            if (keyExists(output, "SelectCtiItemResult")) {
              var returnResults =
                output.Body.selectCtiItemResponse.selectCtiItemReturn
                  .SelectCtiItemResult.CtiNodes.item;
              if(returnResults){
                removeKeys(returnResults, "$");
                resolve(clean(returnResults));
              }else{
                reject("Response empty");
              }
            }
          } else {
            reject("Response empty");
          }
        }
      );
    });
  },
};
