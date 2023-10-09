const risPortService = require("../main");
const path = require('path');

// If not production load the local env file
if(process.env.NODE_ENV === "development"){
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', 'development.env') })
}else if(process.env.NODE_ENV === "test"){
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', 'test.env') })
}else if(process.env.NODE_ENV === "staging"){
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', 'staging.env') })
}

let service = new risPortService(process.env.CUCM_HOSTNAME, process.env.CUCM_USERNAME, process.env.CUCM_PASSWORD);

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
