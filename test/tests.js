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
  CUCM_SSO_COOKIE: str({ default: "", desc: "SSO Cookie for cookie-only authentication testing." }),
});

(async () => {
  var cookie = null; // We will store the cookie here
  let service = new risPortService(env.CUCM_HOSTNAME, env.CUCM_USERNAME, env.CUCM_PASSWORD);

  var models = service.returnModels();

  console.log("Let's list out all the models we support");
  console.log(models);

  var statusReasons = service.returnStatusReasons();

  console.log("Let's list out all the status reasons we could see.");
  console.log(statusReasons);

  console.log("Trying with model name Any");

  await service
    .selectCmDevice("SelectCmDeviceExt", 2000, "Any", "", "Any", "", "Name", "", "Any", "Any")
    .then((response) => {
      cookie = response.cookie;
      console.log("SelectCmDeviceExt Results:", "\n", JSON.stringify(response.results));
    })
    .catch((error) => {
      console.log(error);
    });

  console.log("Use cookie we got from the previous request for all subsequent requests");
  if (cookie) {
    service = new risPortService(env.CUCM_HOSTNAME, "", "", { cookie: cookie });
  }

   console.log("Trying with model name Cisco 8821."); 

  await service
    .selectCmDevice("SelectCmDeviceExt", 2000, "Any", "Cisco 8821", "Any", "", "Name", "", "Any", "Any")
    .then((response) => {
      console.log("SelectCmDeviceExt Results:", "\n", JSON.stringify(response.results));
    })
    .catch((error) => {
      console.log(error);
    });

  console.log("Listing CtiDevice Results");
  await service
    .selectCtiDevice(2000, "Line", "Any", "", "AppId", "", "", "")
    .then((response) => {
      console.log("SelectCtiDevice Results:", "\n", JSON.stringify(response.results));
    })
    .catch((error) => {
      console.log(error);
    });

  // ---- SSO Cookie Authentication Tests ----
  if (env.CUCM_SSO_COOKIE) {
    console.log("\n--- SSO Cookie Authentication Tests ---\n");

    console.log("Creating service with SSO cookie only (no username/password)");
    let ssoService = new risPortService(env.CUCM_HOSTNAME, "", "", { cookie: env.CUCM_SSO_COOKIE });

    console.log("SSO: Verifying cookie is set on service");
    console.log("SSO: getCookie():", ssoService.getCookie());

    console.log("SSO: SelectCmDeviceExt with cookie-only auth");
    await ssoService
      .selectCmDevice("SelectCmDeviceExt", 2000, "Any", "", "Any", "", "Name", "", "Any", "Any")
      .then((response) => {
        console.log("SSO: SelectCmDeviceExt Results:", "\n", JSON.stringify(response.results));
        console.log("SSO: Response cookie:", response.cookie ? "received" : "none");
      })
      .catch((error) => {
        console.log("SSO: SelectCmDeviceExt Error:", error);
      });

    console.log("SSO: SelectCtiDevice with cookie-only auth");
    await ssoService
      .selectCtiDevice(2000, "Line", "Any", "", "AppId", "", "", "")
      .then((response) => {
        console.log("SSO: SelectCtiDevice Results:", "\n", JSON.stringify(response.results));
      })
      .catch((error) => {
        console.log("SSO: SelectCtiDevice Error:", error);
      });

    console.log("SSO: Verifying cookie is preserved after requests");
    console.log("SSO: getCookie() after requests:", ssoService.getCookie());

    console.log("\n--- SSO Cookie Authentication Tests Complete ---\n");
  } else {
    console.log("\nSkipping SSO Cookie Authentication tests (CUCM_SSO_COOKIE not set)");
  }
})();
