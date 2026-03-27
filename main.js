const fetch = require("fetch-retry")(global.fetch);
const util = require("util");
const Models = require("./lib/Model");
const statusReasons = require("./lib/statusReasons");
const parseString = require("xml2js").parseString;
const stripPrefix = require("xml2js").processors.stripPrefix;
const http = require("http");

// Extract faultstring as a plain string — xml2js may return an object
function extractFaultString(fault) {
  if (!fault) return "Unknown SOAP fault";
  const fs = fault.faultstring;
  if (typeof fs === "string") return fs;
  if (fs && typeof fs === "object") return fs._ || JSON.stringify(fs);
  return String(fault.faultcode || "Unknown SOAP fault");
}

class RisPortError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "RisPortError";
    this.status = status;
    this.code = code;
  }
}

var XML_ENVELOPE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
 <soapenv:Header/>
 <soapenv:Body>
    <soap:selectCmDevice>
       <soap:StateInfo>%s</soap:StateInfo>
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
       <soap:StateInfo>%s</soap:StateInfo>
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

/**
 * Escape XML special characters to prevent XML injection
 * @param {string} str
 * @returns {string}
 */
function escapeXml(str) {
  if (typeof str !== "string") return String(str);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Cisco RisPort Service
 * This is a service class that uses fetch and promises to pull RisPort data from Cisco CUCM via SOAP
 *
 * @class risPortService
 */
class risPortService {
  constructor(host, username, password, options = {}, retry = true) {
    this._OPTIONS = {
      retryOn: async function (attempt, error, response) {
        if (!retry) {
          return false;
        }
        if (
          attempt > (process.env.RP_RETRY ? parseInt(process.env.RP_RETRY) : 3)
        ) {
          return false;
        }
        if (error !== null || response.status >= 400) {
          const delay = (ms) =>
            new Promise((resolve) => setTimeout(resolve, ms));
          await delay(
            process.env.RP_RETRY_DELAY
              ? parseInt(process.env.RP_RETRY_DELAY)
              : 5000,
          );
          return true;
        }
      },
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(username + ":" + password).toString("base64"),
        "Content-Type": "text/xml;charset=UTF-8",
        Connection: "keep-alive",
      },
    };
    if (options) {
      this._OPTIONS.headers = Object.assign(this._OPTIONS.headers, options);
    }
    this._HOST = host;
    this._cookie = null;
    this._maxRateLimitRetries = process.env.RP_RATE_LIMIT_RETRIES
      ? parseInt(process.env.RP_RATE_LIMIT_RETRIES)
      : 3;
  }

  /**
   * Get a cloned copy of the options to avoid shared mutable state (Bug #4 fix)
   * @returns {object} cloned options
   */
  _cloneOptions() {
    return {
      ...this._OPTIONS,
      headers: { ...this._OPTIONS.headers },
    };
  }

  /**
   * Get the current cookie
   * @returns {string|null}
   */
  getCookie() {
    return this._cookie;
  }

  /**
   * Set a cookie for session reuse
   * @param {string} cookie
   */
  setCookie(cookie) {
    this._cookie = cookie;
    this._OPTIONS.headers.cookie = cookie;
  }

  /**
   * Post Fetch using Cisco RisPort API
   *
   * @selectCmDevice
   * @memberof risPortService
   * @param {('SelectCmDevice'|'SelectCmDeviceExt')|object} soapActionOrOpts - The soap action to use, or an options object
   * @param {number} [maxReturnedDevices] - The maximum number of devices to return. The maximum parameter value is 2000.
   * @param {('Any'|'Phone'|'Gateway'|'H323'|'Cti'|'VoiceMail'|'MediaResources'|'HuntList'|'SIPTrunk'|'Unknown')} [deviceclass] - The device class to query for real-time status.
   * @param {string|number} [model] - The model to search for or 255 for "any model". Alternatively, you can use the model name.
   * @param {('Any'|'Registered'|'UnRegistered'|'Rejected'|'PartiallyRegistered'|'Unknown')} [status] - The status to search for.
   * @param {string} [node] - The UC Manager node name to query.
   * @param {('Name'|'IPV4Address'|'IPV6Address'|'DirNumber'|'Description'|'SIPStatus')} [selectBy] - The select by to search for.
   * @param {string|array} [selectItem] - An array of one or more item elements.
   * @param {('Any'|'SCCP'|'SIP'|'Unknown')} [protocol] - The protocol to search for.
   * @param {('Any'|'Upgrading'|'Successful'|'Failed'|'Unknown')} [downloadStatus] - The download status to search for.
   * @param {string} [stateInfo] - StateInfo for pagination. Leave empty for first request.
   * @returns {object} returns an object with cookie, results, and stateInfo
   */
  async selectCmDevice(
    soapActionOrOpts,
    maxReturnedDevices,
    deviceclass,
    model,
    status,
    node,
    selectBy,
    selectItem,
    protocol,
    downloadStatus,
    stateInfo,
  ) {
    // Feature #12: Support named parameters via options object
    let soapAction;
    if (typeof soapActionOrOpts === "object" && soapActionOrOpts !== null) {
      const opts = soapActionOrOpts;
      soapAction = opts.action || opts.soapAction;
      maxReturnedDevices = opts.maxReturned || opts.maxReturnedDevices;
      deviceclass = opts.deviceClass || opts.deviceclass;
      model = opts.model;
      status = opts.status;
      node = opts.node || opts.nodeName || "";
      selectBy = opts.selectBy;
      selectItem = opts.selectItems || opts.selectItem;
      protocol = opts.protocol;
      downloadStatus = opts.downloadStatus;
      stateInfo = opts.stateInfo || "";
    } else {
      soapAction = soapActionOrOpts;
      stateInfo = stateInfo || "";
    }

    try {
      let options = this._cloneOptions();
      let host = this._HOST;
      options.SOAPAction = `http://schemas.cisco.com/ast/soap/action/#RisPort#${soapAction}`;
      let itemStr;
      let XML;

      if (Array.isArray(selectItem)) {
        itemStr = selectItem
          .map(
            (phoneName) =>
              "<soap:item>" +
              "<soap:Item>" +
              escapeXml(phoneName) +
              "</soap:Item>" +
              "</soap:item>",
          )
          .join("");
      } else {
        itemStr =
          "<soap:item>" +
          "<soap:Item>" +
          escapeXml(selectItem) +
          "</soap:Item>" +
          "</soap:item>";
      }

      if (!Number.isInteger(model)) {
        // "All", "Any", or empty string all mean 255 (any model)
        if (!model || model === "All" || model === "Any") {
          model = 255;
        } else {
          const found = Object.keys(Models).find(
            (key) => Models[key] === model,
          );
          model = found ? parseInt(found) : 255;
        }
      }

      if (soapAction === "SelectCmDeviceExt") {
        XML = util.format(
          XML_EXT_ENVELOPE,
          stateInfo,
          maxReturnedDevices,
          deviceclass,
          model,
          status,
          node,
          selectBy,
          itemStr,
          protocol,
          downloadStatus,
        );
      } else {
        XML = util.format(
          XML_ENVELOPE,
          stateInfo,
          maxReturnedDevices,
          deviceclass,
          model,
          status,
          node,
          selectBy,
          itemStr,
          protocol,
          downloadStatus,
        );
      }

      let soapBody = Buffer.from(XML);
      options.body = soapBody;

      let rateLimitAttempt = 0;

      while (true) {
        let response = await fetch(
          `https://${host}:8443/realtimeservice2/services/RISService70`,
          options,
        );

        let promiseResults = {
          cookie: "",
          results: "",
          stateInfo: "",
        };

        const responseCookie = response.headers.get("set-cookie")
          ? response.headers.get("set-cookie")
          : "";
        promiseResults.cookie = responseCookie;

        // Feature #14: Auto-capture cookies for session reuse
        if (responseCookie) {
          this._cookie = responseCookie;
          this._OPTIONS.headers.cookie = responseCookie;
        }

        let output = await parseXml(await response.text());
        removeKeys(output, "$");

        if (!response.ok) {
          throw new RisPortError(
            extractFaultString(output?.Body?.Fault),
            response.status,
            http.STATUS_CODES[response.status],
          );
        }

        // Feature #10: Rate limit detection at SOAP level
        const faultStr = extractFaultString(output?.Body?.Fault);
        if (output?.Body?.Fault && faultStr.includes("Exceeded allowed rate")) {
          if (rateLimitAttempt < this._maxRateLimitRetries) {
            const backoffMs = 30000 * Math.pow(2, rateLimitAttempt);
            rateLimitAttempt++;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
          throw new RisPortError(faultStr, 429, "RateLimited");
        }

        // Catch any other SOAP faults in 200 responses
        if (output?.Body?.Fault) {
          throw new RisPortError(faultStr, 500, "SOAPFault");
        }

        if (output?.Body?.selectCmDeviceResponse?.selectCmDeviceReturn) {
          let returnData =
            output.Body.selectCmDeviceResponse.selectCmDeviceReturn;
          let returnResults = returnData?.SelectCmDeviceResult?.CmNodes?.item;
          promiseResults.results = returnResults
            ? enrichStatusReasons(clean(returnResults))
            : "";
          // Feature #11: Capture StateInfo for pagination
          promiseResults.stateInfo = returnData?.StateInfo || "";
          return promiseResults;
        } else {
          return promiseResults;
        }
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Paginate through all results using StateInfo
   *
   * @memberof risPortService
   * @param {('SelectCmDevice'|'SelectCmDeviceExt')|object} soapActionOrOpts - The soap action or options object
   * @param {number} [maxReturnedDevices] - Max devices per page
   * @param {string} [deviceclass]
   * @param {string|number} [model]
   * @param {string} [status]
   * @param {string} [node]
   * @param {string} [selectBy]
   * @param {string|array} [selectItem]
   * @param {string} [protocol]
   * @param {string} [downloadStatus]
   * @returns {object} returns an object with cookie and all aggregated results
   */
  async selectCmDevicePaginated(
    soapActionOrOpts,
    maxReturnedDevices,
    deviceclass,
    model,
    status,
    node,
    selectBy,
    selectItem,
    protocol,
    downloadStatus,
  ) {
    let allResults = [];
    let currentStateInfo = "";
    let cookie = "";

    while (true) {
      let result;
      if (typeof soapActionOrOpts === "object" && soapActionOrOpts !== null) {
        result = await this.selectCmDevice({
          ...soapActionOrOpts,
          stateInfo: currentStateInfo,
        });
      } else {
        result = await this.selectCmDevice(
          soapActionOrOpts,
          maxReturnedDevices,
          deviceclass,
          model,
          status,
          node,
          selectBy,
          selectItem,
          protocol,
          downloadStatus,
          currentStateInfo,
        );
      }

      if (result.cookie) cookie = result.cookie;

      if (result.results && Array.isArray(result.results)) {
        allResults = allResults.concat(result.results);
      } else if (result.results) {
        allResults.push(result.results);
      }

      if (!result.stateInfo || result.stateInfo === currentStateInfo) {
        break;
      }
      currentStateInfo = result.stateInfo;
    }

    return { cookie, results: allResults };
  }

  /**
   * Batch large device lists into chunks and merge results
   *
   * @memberof risPortService
   * @param {('SelectCmDevice'|'SelectCmDeviceExt')|object} soapActionOrOpts - The soap action or options object
   * @param {object} [criteria] - Selection criteria (when using positional args style: { deviceClass, model, status, selectBy, protocol, downloadStatus })
   * @param {string[]} selectItems - Full array of device names/items
   * @param {object} [batchOptions] - Batching options
   * @param {number} [batchOptions.chunkSize=1000] - Number of items per batch
   * @param {number} [batchOptions.delayMs=5000] - Delay between batches in ms
   * @param {function} [batchOptions.onProgress] - Progress callback (batchIndex, totalBatches)
   * @returns {object} returns an object with cookie and all merged results
   */
  async selectCmDeviceBatched(
    soapActionOrOpts,
    criteria,
    selectItems,
    batchOptions = {},
  ) {
    const chunkSize = batchOptions.chunkSize || 1000;
    const delayMs = batchOptions.delayMs || 5000;
    const onProgress = batchOptions.onProgress || null;

    const chunks = [];
    for (let i = 0; i < selectItems.length; i += chunkSize) {
      chunks.push(selectItems.slice(i, i + chunkSize));
    }

    let allResults = [];
    let cookie = "";

    for (let i = 0; i < chunks.length; i++) {
      if (onProgress) onProgress(i, chunks.length);

      let result;
      if (typeof soapActionOrOpts === "object" && soapActionOrOpts !== null) {
        result = await this.selectCmDevice({
          ...soapActionOrOpts,
          selectItems: chunks[i],
        });
      } else {
        result = await this.selectCmDevice(
          soapActionOrOpts,
          criteria.maxReturned || 2000,
          criteria.deviceClass || "Any",
          criteria.model || 255,
          criteria.status || "Any",
          criteria.node || "",
          criteria.selectBy || "Name",
          chunks[i],
          criteria.protocol || "Any",
          criteria.downloadStatus || "Any",
        );
      }

      if (result.cookie) cookie = result.cookie;

      if (result.results && Array.isArray(result.results)) {
        allResults = allResults.concat(result.results);
      } else if (result.results) {
        allResults.push(result.results);
      }

      // Delay between batches to avoid rate limiting (except after last batch)
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    if (onProgress) onProgress(chunks.length, chunks.length);
    return { cookie, results: allResults };
  }

  /**
   * Post Fetch using Cisco RisPort CTI API
   *
   * @selectCtiDevice
   * @memberof risPortService
   * @returns {object} returns an object with cookie and results
   */
  async selectCtiDevice(
    maxReturnedDevices,
    ctiMgrClass,
    status,
    node,
    selectAppBy,
    appItem,
    devName,
    dirNumber,
  ) {
    try {
      let appItemsStr;
      let devNamesStr;
      let dirNumbersStr;
      let options = this._cloneOptions();
      let XML;
      let host = this._HOST;
      options.SOAPAction = `http://schemas.cisco.com/ast/soap/action/#RisPort#SelectCtiItem`;

      if (Array.isArray(appItem)) {
        appItemsStr = appItem
          .map(
            (item) =>
              "<soap:item>" +
              "<soap:AppItem>" +
              escapeXml(item) +
              "</soap:AppItem>" +
              "</soap:item>",
          )
          .join("");
      } else {
        appItemsStr =
          "<soap:item>" +
          "<soap:AppItem>" +
          escapeXml(appItem) +
          "</soap:AppItem>" +
          "</soap:item>";
      }

      // Bug #1 fix: was using appItem instead of devName
      if (Array.isArray(devName)) {
        devNamesStr = devName
          .map(
            (item) =>
              "<soap:item>" +
              "<soap:DevName>" +
              escapeXml(item) +
              "</soap:DevName>" +
              "</soap:item>",
          )
          .join("");
      } else {
        devNamesStr =
          "<soap:item>" +
          "<soap:DevName>" +
          escapeXml(devName) +
          "</soap:DevName>" +
          "</soap:item>";
      }

      if (Array.isArray(dirNumber)) {
        dirNumbersStr = dirNumber
          .map(
            (item) =>
              "<soap:item>" +
              "<soap:DirNumber>" +
              escapeXml(item) +
              "</soap:DirNumber>" +
              "</soap:item>",
          )
          .join("");
      } else {
        dirNumbersStr =
          "<soap:item>" +
          "<soap:DirNumber>" +
          escapeXml(dirNumber) +
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
        dirNumbersStr,
      );

      let soapBody = Buffer.from(XML);
      options.body = soapBody;

      let rateLimitAttempt = 0;

      while (true) {
        let response = await fetch(
          `https://${host}:8443/realtimeservice2/services/RISService70`,
          options,
        );

        let promiseResults = {
          cookie: "",
          results: "",
        };

        const responseCookie = response.headers.get("set-cookie")
          ? response.headers.get("set-cookie")
          : "";
        promiseResults.cookie = responseCookie;

        if (responseCookie) {
          this._cookie = responseCookie;
          this._OPTIONS.headers.cookie = responseCookie;
        }

        let output = await parseXml(await response.text());
        removeKeys(output, "$");

        if (!response.ok) {
          throw new RisPortError(
            extractFaultString(output?.Body?.Fault),
            response.status,
            http.STATUS_CODES[response.status],
          );
        }

        // Feature #10: Rate limit detection
        const ctiFaultStr = extractFaultString(output?.Body?.Fault);
        if (
          output?.Body?.Fault &&
          ctiFaultStr.includes("Exceeded allowed rate")
        ) {
          if (rateLimitAttempt < this._maxRateLimitRetries) {
            const backoffMs = 30000 * Math.pow(2, rateLimitAttempt);
            rateLimitAttempt++;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
          throw new RisPortError(ctiFaultStr, 429, "RateLimited");
        }

        // Catch any other SOAP faults in 200 responses
        if (output?.Body?.Fault) {
          throw new RisPortError(ctiFaultStr, 500, "SOAPFault");
        }

        if (output?.Body?.selectCtiItemResponse?.selectCtiItemReturn) {
          let returnResults =
            output?.Body?.selectCtiItemResponse?.selectCtiItemReturn
              ?.SelectCtiItemResult?.CtiNodes?.item;
          promiseResults.results = returnResults ? clean(returnResults) : "";
          return promiseResults;
        } else {
          return promiseResults;
        }
      }
    } catch (error) {
      throw error;
    }
  }

  returnModels() {
    return Models;
  }

  returnStatusReasons() {
    return statusReasons;
  }
}

/**
 * Remove all specified keys from an object, no matter how deep they are.
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

// Bug #3 fix: Rewritten to avoid splice-during-iteration.
// Uses filter for arrays and delete for object keys.
const clean = (object) => {
  if (Array.isArray(object)) {
    for (let i = 0; i < object.length; i++) {
      if (object[i] && typeof object[i] === "object") {
        clean(object[i]);
      }
    }
    // Filter out null, undefined, and empty objects in place
    let writeIdx = 0;
    for (let readIdx = 0; readIdx < object.length; readIdx++) {
      const v = object[readIdx];
      const isEmpty =
        (v && typeof v === "object" && !Object.keys(v).length) ||
        v === null ||
        v === undefined;
      if (!isEmpty) {
        object[writeIdx] = v;
        writeIdx++;
      }
    }
    object.length = writeIdx;
  } else if (object && typeof object === "object") {
    for (const [k, v] of Object.entries(object)) {
      if (v && typeof v === "object") {
        clean(v);
      }
      if (
        (v && typeof v === "object" && !Object.keys(v).length) ||
        v === null ||
        v === undefined
      ) {
        delete object[k];
      }
    }
  }
  return object;
};

/**
 * Feature #13: Enrich device results with human-readable status reasons
 */
const enrichStatusReasons = (results) => {
  if (!results) return results;
  const items = Array.isArray(results) ? results : [results];
  for (const node of items) {
    if (node?.CmDevices?.item) {
      const devices = Array.isArray(node.CmDevices.item)
        ? node.CmDevices.item
        : [node.CmDevices.item];
      for (const device of devices) {
        if (device.StatusReason !== undefined) {
          const code = parseInt(device.StatusReason);
          if (statusReasons[code] !== undefined) {
            device.StatusReasonText = statusReasons[code];
          }
        }
      }
    }
  }
  return results;
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
      },
    );
  });
};

risPortService.RisPortError = RisPortError;
module.exports = risPortService;
