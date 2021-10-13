//Handles the webhooks that have been subbed to from twitch Helix API

require("dotenv").config({ path: "secret/.env" });
const express = require("express");
const router = express.Router();
const axios = require("axios");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose(); //TODO convert this to better-sqlite3
const db = new sqlite3.Database(process.env.ROOT_DIR + "/secret/database.db");
const dbHandler = require(__dirname + "/Database.js");
const newdb = dbHandler.db;
const dbEmitter = dbHandler.Events;
const bodyParser = require("body-parser");

const ClientID = process.env.TwitchAPIClientID;
const ClientSecret = process.env.TwitchAPIClientSecret;
const BaseCallbackURLShort = "/twitch/webhook/";
const BaseCallbackURL = "https://beddlebot.com" + BaseCallbackURLShort;

const SubShort = {
  follow: "channel.follow",
  sub: "channel.subscribe",
  giftsub: "channel.subscription.gift",
  resub: "channel.subscription.message",
  cheer: "channel.cheer",
  raid: "channel.raid",
  points_redemption: "channel.channel_points_custom_reward_redemption.add",
  poll_begin: "	channel.poll.begin",
  poll_progress: "channel.poll.progress",
  poll_end: "channel.poll.end",
  prediciton_begin: "channel.prediction.begin",
  prediciton_progress: "channel.prediction.progress",
  prediciton_lock: "channel.prediction.lock",
  prediciton_end: "channel.prediction.end",
  hypetrain_begin: "channel.hype_train.begin",
  hypetrain_progress: "channel.hype_train.progress",
  hypetrain_end: "channel.hype_train.end",
  stream_begin: "stream.online",
  stream_end: "stream.offline",
  auth_revoke: "	user.authorization.revoke",
  user_update: "	user.update",
};

//Function to make a new eventsub subscription
//Subtype is the table column name, Subname is the sub that tells twitch what to use
function Subscribe(UserID, Subtype, Secret) {
  Subtype = Subtype.toLowerCase();
  console.log("Sub type: " + Subtype);

  //First check if sub type is part of the sub list
  if (!(Subtype in SubShort)) {
    console.log(`ERROR: Subtype ${Subtype} does not exist. Ignoring`);
    return;
  }

  //Check if the db has it disabled
  var row = newdb
    .prepare(
      `
    SELECT * FROM twitch_webhooks WHERE user_id = $user_id;
  `
    )
    .get({
      user_id: UserID,
      subtype: Subtype,
    });

  if (row[Subtype] == "disabled") {
    console.log(`Sub is disabled, ignoring: ${UserID} ${Subtype}`);
    //return;
  }

  //Check if theres already a sub token there
  if ((row[Subtype] != null) & (row[Subtype] != "")) {
    console.log(`Sub already exists, ignoring: ${UserID} ${Subtype}`);
    //return;
  }

  //get the official twitch sub name
  var Subname = SubShort[Subtype];

  console.log(`Making new event sub: ${UserID} ${Subname} ${Subtype}`);

  var Request = {
    type: Subname,
    version: "1",
    condition: {
      broadcaster_user_id: UserID,
    },
    transport: {
      method: "webhook",
      callback: BaseCallbackURL + Subtype,
      secret: Secret,
    },
  };

  db.get(
    `
    SELECT client_credentials_token FROM twitch_tokens
    WHERE user_id = ?1;
  `,
    { 1: UserID },
    function (err, row) {
      if (err) {
        console.log(err);
        return;
      }

      var AccessToken = row.client_credentials_token;

      //Use the access token to creat a new event sub
      axios
        .post("https://api.twitch.tv/helix/eventsub/subscriptions", Request, {
          headers: {
            Authorization: "Bearer " + AccessToken,
            "Client-ID": ClientID,
            "Content-Type": "application/json",
          },
        })
        .then(function (response) {
          //console.log(JSON.stringify(response.data, null, 10));
          return response.data;
          //UPDATE twitch_webhooks SET ?1 = ?2 WHERE user_id = ?3;
        })
        .catch(function (error) {
          console.log(error);
          return error;
        });
    }
  );
}

function EnableSub() {
  //TODO remove "disabled" from sub record and then Subscribe()
}
module.exports.EnableSub = EnableSub;

function DisableSub() {
  //TODO add "disabled" to sub entry, next webhook call will check it and remove the sub
}
module.exports.EnableSub = DisableSub;

//Collect all the web sockets
dbEmitter.on("AddedUser", function (UserID) {
  console.log("checking DB for webhook data");

  //Generate new secret for user
  var Secret = crypto.randomBytes(20).toString("hex");

  //Create new record with secret if user does not exist
  newdb
    .prepare(
      `
    INSERT INTO "twitch_webhooks" (user_id, secret)
    SELECT $user_id, $secret
    WHERE NOT EXISTS (SELECT user_id FROM "twitch_webhooks" WHERE user_id = $user_id)
  `
    )
    .run({
      user_id: UserID,
      secret: Secret,
    });

  console.log("added secret " + Secret);

  //newdb.prepare('SELECT secret FROM twitch_webhooks WHERE user_id = ?').get(Body.subscription.condition.broadcaster_user_id);

  //check what subs are disabled by the user, if null then make new sub
  db.get(
    `
    SELECT * FROM twitch_webhooks
    WHERE user_id = ?1;
    `,
    { 1: UserID },
    function (error, row) {
      if (error) {
        console.log(error);
        return;
      }
      Subscribe(UserID, "follow", Secret);
    }
  );
});

//Use this fuction to varify the message came from twitch and to accept any challenge
function Verify(req, res, buf, encoding) {
  console.log("Verifying webhook");
  console.log(req);
  console.log(res);
  console.log(buf);
  console.log(encoding);
  return; //Trying to get proper results before going any further
  if (
    !req.headers &&
    !req.headers.hasOwnProperty("twitch-eventsub-message-signature")
  ) {
    res.status(403).send("");
    return;
  }
  console.log(req.headers);
  if (typeof req.body.challenge !== "undefined") {
    console.log("Accepting challenge");
    var MessageID = req.headers["twitch-eventsub-message-id"];
    var Timestamp = req.headers["twitch-eventsub-message-timestamp"];
    var Signature = req.headers["twitch-eventsub-message-signature"];
    var Body = req.body;
    var Secret = newdb
      .prepare("SELECT secret FROM twitch_webhooks WHERE user_id = ?")
      .get(Body.subscription.condition.broadcaster_user_id).secret;

    console.log("Aquired data");
    console.log(Secret);
    console.log("");
    console.log(MessageID);
    console.log(Timestamp);
    console.log(Body);
    console.log("");

    var hmac_message = MessageID + Timestamp + Body;
    var hmac = crypto.createHmac("sha256", Secret);
    var data = hmac.update(hmac_message);
    var gen_hmac = "sha256=" + data.digest("hex");

    console.log("Hash result:    " + gen_hmac);
    console.log("Hash expectied: " + Signature);

    return; //Successful varification
  }
  res.status(403).send(""); //Failed verification
}
module.exports.Verify = Verify;

router.post(BaseCallbackURLShort + "follow", (req, res) => {
  var body = req.body;
  console.log("\n");
  //console.log(body)
  console.log("Follow hook just called --- \n");
  //res.send('ok')
  res.status(200).end();
});

router.post(BaseCallbackURLShort + "redemption", (req, res) => {
  var body = req.body;
  console.log(body);

  //accepting subevent challenge
  if (typeof req.body.challenge !== "undefined") {
    console.log("Accepting challenge");
    res.send(req.body.challenge);
    res.status(200).end();
    return;
  }

  res.send("ok");
  res.status(200).end();
});

module.exports = router;
