const risPortService = require("../main");
const path = require('path');
const { cleanEnv, str, host } = require("envalid");

// If not production load the local env file
if(process.env.NODE_ENV === "development"){
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', 'development.env') })
}else if(process.env.NODE_ENV === "test"){
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', 'test.env') })
}else if(process.env.NODE_ENV === "staging"){
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', 'staging.env') })
}

const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production", "staging"],
    desc: "Node environment",
  }),
  CUCM_HOSTNAME: host({ desc: "Cisco CUCM Hostname or IP Address to send the perfmon request to. Typically the publisher." }),
  CUCM_USERNAME: str({ desc: "Cisco CUCM AXL Username." }),
  CUCM_PASSWORD: str({ desc: "Cisco CUCM AXL Password." })
});

let service = new risPortService(env.CUCM_HOSTNAME, env.CUCM_USERNAME, env.CUCM_PASSWORD);

service
  .selectCmDevice(
    "SelectCmDeviceExt",1000,"Any","","Any","","Name","","Any","Any")
  .then((results) => {
    console.log("SelectCmDeviceExt Results:", "\n", JSON.stringify(results));
  })
  .catch((error) => {
    console.log(error);
  });

service
  .selectCtiDevice(1000, "Line", "Any", "", "AppId", "", "", "")
  .then((results) => {
    console.log("SelectCtiDevice Results:", "\n", JSON.stringify(results));
  })
  .catch((error) => {
    console.log(error);
  });
