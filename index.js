//Entry point

process.env.ROOT_DIR = __dirname;

const BaseDir = __dirname + "/base/";
require(BaseDir + "twitch/APITwitch/Database.js");
require(BaseDir + "twitch/APITwitch/APITwitchHelix.js");
require(BaseDir + "twitch/APITwitch/APITwitchTMI.js");
