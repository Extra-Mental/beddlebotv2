//Sets up the database for inital run, also handles the Oauth2 events via twitch

//I want to migrate everything from sqlite3 to better-sqlite3 as the latter is asyncronous and will be easer to code for

//const sqlite3 = require('sqlite3').verbose();
//const db = new sqlite3.Database(process.env.ROOT_DIR+'/secret/database.db');
const Database = require("better-sqlite3");
const events = require("events");

const db = new Database(process.env.ROOT_DIR + "/secret/database.db", {
  verbose: console.log,
  fileMustExist: true,
});
module.exports.db = db;

const Emitter = new events.EventEmitter();
module.exports.Events = Emitter;

//Emit message when user has been added or removed from DB
Emitter.on("AddedUser", (UserID) => {
  console.log(
    UserID + "has been authed and added to the main table of database"
  );
});

Emitter.on("RemovedUser", (UserID) => {
  console.log(
    UserID + "has been deauthed and removed from the main table of database"
  );
});

//Setup DB tables - for some reason sqlie3 cant do them all at once
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS "twitch_users" (
    "user_id"	INTEGER,
    "username"	TEXT,
    "is_live" INTEGER,
    "permanent" INTAGER,
    "last_active" INTEGER,
    PRIMARY KEY("user_id")
  );
`
).run();
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS "twitch_tokens" (
    "user_id"	INTEGER,
    "auth_code_token"	TEXT,
    "auth_code_refresh_token"	TEXT,
    "auth_code_expiry_time"	INTEGER,
    "client_credentials_token"	TEXT,
    "client_credentials_expiry_time"	INTEGER,
    PRIMARY KEY("user_id")
  );
`
).run();
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS "twitch_webhooks" (
    "user_id"	INTEGER,
    "secret" TEXT,
    "follow" TEXT,
    "sub" TEXT,
    "giftsub" TEXT,
    "resub" TEXT,
    "cheer" TEXT,
    "raid" TEXT,
    "points_redemption" TEXT,
    "poll_begin" TEXT,
    "poll_progress" TEXT,
    "poll_end" TEXT,
    "prediciton_begin" TEXT,
    "prediciton_progress" TEXT,
    "prediciton_lock" TEXT,
    "prediciton_end" TEXT,
    "hypetrain_begin" TEXT,
    "hypetrain_progress" TEXT,
    "hypetrain_end" TEXT,
    "stream_begin" TEXT,
    "stream_end" TEXT,
    "auth_revoke" TEXT,
    "user_update" TEXT,
    PRIMARY KEY("user_id")
  );
`
).run();

console.log("Created tables");
