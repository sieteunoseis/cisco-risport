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
