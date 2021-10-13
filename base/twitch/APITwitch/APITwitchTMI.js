//Handles the API for the bots account such as sending message in chat
require("dotenv").config({ path: "secret/.env" });
const tmi = require("tmi.js");

//require(__dirname+"/ActiveChannels.js"); //Need to run this first to collect all the usernames to join

function Connect(UsersArray) {
  const client = new tmi.Client({
    options: { debug: true },
    connection: {
      secure: true,
      reconnect: true,
    },
    identity: {
      username: "BeddleBot",
      password: process.env.tmiOauth,
    },
    channels: UsersArray,
  });

  client.connect();
  module.exports.client = client;

  //Require all the other files here
}

module.exports.Connect = Connect;
