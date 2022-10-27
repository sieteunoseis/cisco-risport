const ciscoRisPort = require("../main");

var server = {
  hostname: "192.168.1.230",
  username: "administrator",
  password: "h0mel@b",
};

(async () => {
  let output = await ciscoRisPort
    .selectCmDevice(
      server.hostname,
      server.username,
      server.password,
      "SelectCmDevice",
      1000,
      "Any",
      "Hello",
      "Any",
      "Name",
      "",
      "Any",
      "Any"
    )
    .catch((err) => {
      console.log(err);
      return false;
    });
  console.log(JSON.stringify(output));
})();

(async () => {
  let output = await ciscoRisPort
    .selectCtiDevice(
      server.hostname,
      server.username,
      server.password,
      "1000",
      "Line",
      "Any",
      "AppId",
      "",
      "",
      ""
    )
    .catch((err) => {
      console.log(err);
      return false;
    });
  console.log(JSON.stringify(output));
})();
