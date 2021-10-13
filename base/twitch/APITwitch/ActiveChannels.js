//This script monitors the activity of the user, if activity is low it will not join a channel or almost none then delete data from the db

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(process.env.ROOT_DIR+'/secret/database.db');
var TMI = require(__dirname+"/APITwitchTMI.js");
const dbHandler = require(__dirname+"/Database.js");
const dbEmitter = dbHandler.Events;

const Expiration = 60*60*24*3; //3 Days - the length of time the channel has been inactive to not join the channel

function JoinChannel(UserID){
  //Get the username using the ID
  db.get(`
    SELECT username FROM twitch_users
    WHERE user_id = ?1;
  `,
    {1:UserID},
    function(err, row){
      if(error){
        console.log(error);
        return;
      };

      var Username = row.username
      TMI = require(__dirname+"/APITwitchTMI.js");
      TMI.client.join(Username)
      .then((data) => {
          console.log("Joined channel " + Username);
      }).catch((err) => {
          console.log(err);
      });

      db.run(`
        UPDATE twitch_users
        SET last_active = ?1
        WHERE user_id = ?2
      `, {1:Date.now(), 2:UserID}, function (error){
        if(error){
          console.log(error);
          return;
        };
      );
    };
  );
};
module.exports.JoinChannel = JoinChannel;

function LeaveChannel(UserID){
  //Get the username using the ID
  db.get(`
    SELECT username FROM twitch_users
    WHERE user_id = ?1;
  `,
    {1:UserID},
    function(err, row){
      if(error){
        console.log(error);
        return;
      };

      var Username = row.username
      TMI = require(__dirname+"/APITwitchTMI.js");
      TMI.client.part(Username)
      .then((data) => {
          console.log("Parted channel " + Username);
      }).catch((err) => {
          console.log(err);
      });
    };
  );
};
module.exports.LeaveChannel = LeaveChannel;


//Collect all channels that have been live within expiration and send them to TMI JS - saves time on cooldowns
var ChannelsArray = []
db.each(`
  SELECT username FROM twitch_users
  WHERE last_active + ?1 > ?2 OR permanent = 1;
`,
  {1:Expiration, 2:Date.now()},
  function(err, row){
    //Called on every row found
    console.log("Row data");
    console.log(row);
    ChannelsArray.push(row.username);
  },
  function(error, rowCount){
    //Called when SQL query is completed
    if(error){
      console.log(error);
      return;
    };
    console.log("Prepared channels to join:");
    console.log(ChannelsArray);
    TMI = require(__dirname+"/APITwitchTMI.js");
    TMI.Connect(ChannelsArray);
    ChannelsArray = [];
  }
);

//When a new user is Authed then add them to the list of active channels
dbEmitter.on('AddedUser', function (UserID, Username){
  JoinChannel(UserID);
});
