const risPortService = require("../main");
const path = require("path");
const { cleanEnv, str, host } = require("envalid");

// If not production load the local env file
if (process.env.NODE_ENV === "development") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "development.env") });
} else if (process.env.NODE_ENV === "test") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "test.env") });
} else if (process.env.NODE_ENV === "staging") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "staging.env") });
}

const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production", "staging"],
    desc: "Node environment",
  }),
  CUCM_HOSTNAME: host({ desc: "Cisco CUCM Hostname or IP Address to send the perfmon request to. Typically the publisher." }),
  CUCM_USERNAME: str({ desc: "Cisco CUCM AXL Username." }),
  CUCM_PASSWORD: str({ desc: "Cisco CUCM AXL Password." }),
});

(async () => {
  let service = new risPortService(env.CUCM_HOSTNAME, env.CUCM_USERNAME, env.CUCM_PASSWORD);

  var models = service.returnModels();

  console.log("Let's list out all the models we support");
  console.log(models);

  var statusReasons = service.returnStatusReasons();

  console.log("Let's list out all the models we support");
  console.log(statusReasons);

  console.log("Trying with model name Any");
  await service
    .selectCmDevice("SelectCmDeviceExt", 1000, "Any", "", "Any", "", "Name", "", "Any", "Any")
    .then((results) => {
      console.log("SelectCmDeviceExt Results:", "\n", JSON.stringify(results));
    })
    .catch((error) => {
      console.log(error);
    });

  console.log("Trying with model name Cisco 8821");
  await service
    .selectCmDevice("SelectCmDeviceExt", 1000, "Any", "Cisco 8821", "Any", "", "Name", "", "Any", "Any")
    .then((results) => {
      console.log("SelectCmDeviceExt Results:", "\n", JSON.stringify(results));
    })
    .catch((error) => {
      console.log(error);
    });

  console.log("Listing CtiDevice Results");
  await service
    .selectCtiDevice(1000, "Line", "Any", "", "AppId", "", "", "")
    .then((results) => {
      console.log("SelectCtiDevice Results:", "\n", JSON.stringify(results));
    })
    .catch((error) => {
      console.log(error);
    });
})();
