//Starts a webserver for use with twitch Helix API

require("dotenv").config({ path: "secret/.env" });
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const EventEmitter = require("events");
const emitter = new EventEmitter();

const RootDir = process.env.ROOT_DIR;

emitter.on("uncaughtException", function (err) {
  console.error(err);
});

//Verifying twitch webhooks, it must be handled before any other middleware can access the raw body --
//I would prefer to do it via router.post() in WebHooks.js but there doesnt seem to be a simple way
//Might need to dedicate this web server to this API
app.use(
  express.json({
    verify: function (req, res, buf, encoding) {
      // is there a hub to verify against
      req.twitch_eventsub = false;
      if (
        req.headers &&
        req.headers.hasOwnProperty("twitch-eventsub-message-signature")
      ) {
        req.twitch_eventsub = true;

        // id for dedupe
        let id = req.headers["twitch-eventsub-message-id"];
        // check age
        let timestamp = req.headers["twitch-eventsub-message-timestamp"];
        // extract algo and signature for comparison
        let [algo, signature] =
          req.headers["twitch-eventsub-message-signature"].split("=");

        // you could do
        // req.twitch_hex = crypto.createHmac(algo, config.hook_secret)
        // but we know Twitch should always use sha256
        req.twitch_hex = crypto
          .createHmac("sha256", config.hook_secret)
          .update(id + timestamp + buf)
          .digest("hex");
        req.twitch_signature = signature;

        if (req.twitch_signature != req.twitch_hex) {
          console.error("Signature Mismatch");
        } else {
          console.log("Signature OK");
        }
      }
    },
  })
);

app.use(bodyParser.json());

app.get("/", (req, res) => {
  //console.log(res);
  res.send("home page");
});

//Split web pages into multiple files
//Handles user authentication to allow access to user data
app.use(require(__dirname + "/TwitchAuth.js"));

//Init webhook handler
app.use(require(__dirname + "/WebHooks.js"));

//Start greenlock SSL generator
require("greenlock-express")
  .init({
    packageRoot: RootDir,
    configDir: RootDir + "/secret/greenlock",

    // contact for security and critical bug notices
    maintainerEmail: process.env.GreenLockEmail,

    // whether or not to run at cloudscale
    cluster: false,
  })
  // Serves on 80 and 443
  // Get's SSL certificates magically!
  .serve(app);

module.exports = emitter;
