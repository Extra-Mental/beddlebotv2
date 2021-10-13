require('dotenv').config({ path:'secret/.env'});
const express = require('express');
const router = express.Router();
const axios = require("axios");
//const sqlite3 = require('sqlite3').verbose();
//const db = new sqlite3.Database(process.env.ROOT_DIR+'/secret/database.db');
const dbHandler = require(__dirname+"/Database.js");
const dbEmitter = dbHandler.Events;
const db = dbHandler.db;

//This page handles authentication for users to give permission for the bot to access user data.

const ClientID = process.env.TwitchAPIClientID;
const ClientSecret = process.env.TwitchAPIClientSecret;
const RedirectURI = "https://beddlebot.com/twitch/authredirect";
const Scope = "channel:read:redemptions channel:read:subscriptions channel:read:hype_train channel:read:predictions channel:read:polls bits:read";

const PermanentIDArray = [
  44374179,//Me
  465987079//Beddle
];

function DBAddUser(UserID, Username){

  var IsPermanent = 0
  if(PermanentIDArray.includes(UserID) !== -1){
    IsPermanent = 1;
    //console.log(UserID +" is permanent user");
  };

  try{
    db.prepare(`
      INSERT INTO "twitch_users" (user_id, username, is_live, permanent, last_active)
      SELECT $user_id, $username, $is_live, $permanent, $last_active
      WHERE NOT EXISTS (SELECT user_id FROM "twitch_users" WHERE user_id = $user_id);
    `).run({
      'user_id':UserID,
      'username':Username,
      'is_live':0,
      'permanent':IsPermanent,
      'last_active':Date.now()
    })
  }catch(error){
    console.error(error);
    return false;
  };

  return true;
};

function DBAddTokens(UserID, AuthCodeToken, AuthCodeRefreshToken, AuthCodeTokenExpiry, ClientCredToken, ClientCredExpiry){
  try{
    db.prepare(`
      INSERT INTO "twitch_tokens" (user_id, auth_code_token, auth_code_refresh_token, auth_code_expiry_time, client_credentials_token, client_credentials_expiry_time)
      SELECT $user_id, $AuthCodeToken, $AuthCodeRefreshToken, $AuthCodeTokenExpiry, $ClientCredToken, $ClientCredExpiry
      WHERE NOT EXISTS (SELECT user_id FROM "twitch_tokens" WHERE user_id = $user_id)
    `).run({
      'user_id': UserID,
      'AuthCodeToken': AuthCodeToken,
      'AuthCodeRefreshToken': AuthCodeRefreshToken,
      'AuthCodeTokenExpiry': AuthCodeTokenExpiry,
      'ClientCredToken': ClientCredToken,
      'ClientCredExpiry': ClientCredExpiry
    })
  }catch(error){
    console.error(error);
    return false;
  };
  return true;
};

router.get('/twitch/auth', (req, res) => {
  res.redirect(`https://id.twitch.tv/oauth2/authorize?client_id=${ClientID}&redirect_uri=${RedirectURI}&response_type=code&scope=${Scope}`);
})

router.get('/twitch/authredirect', (req, res) => {

  //console.log(req.query);
  var Code = req.query.code

  //Use given code to request authorization_code access token used for standard API calls
  axios.post('https://id.twitch.tv/oauth2/token', null,
  {
    params: {
      client_id: ClientID,
      client_secret: ClientSecret,
      code: Code,
      grant_type: 'authorization_code',
      redirect_uri: RedirectURI

    }
  })
  .then(function (response) {
    //Here we should have recieved the authorization_code access token

    //console.log("Access token data authorization_code");
    //console.log(JSON.stringify(response.data, null, 10));

    var AuthCodeToken = response.data.access_token;
    var AuthCodeRefreshToken = response.data.refresh_token;
    var AuthCodeTokenExpiry = response.data.expires_in + Date.now(); //Sets variable to the future unix time of expiry in seconds
    //console.log("Auth Code token: " + AuthCodeToken)

    //Uses access token to get user data and save it to the database
    //console.log('getting user data');
    axios.get('https://api.twitch.tv/helix/users', //null,
    {
      headers: {
        'Authorization': 'Bearer ' + AuthCodeToken,
        "Client-Id": ClientID,
        'Content-Type': 'application/json'
      }
    })
    .then(function (response2) {
      //Here we should have data about the recently authed account, such as username and twitch ID

      //console.log("User data");
      //console.log(JSON.stringify(response2.data, null, 10));

      var UserInfo = response2.data.data[0];
      var UserID = UserInfo.id;
      var Username = UserInfo.login;
      var ProfileImgUrl = UserInfo.profile_image_url;

      //Use given code to request client_credentials access token for sub event calls
      axios.post('https://id.twitch.tv/oauth2/token', null,
      {
        params: {
          client_id: ClientID,
          client_secret: ClientSecret,
          code: Code,
          grant_type: 'client_credentials',
          redirect_uri: RedirectURI
        }
      })
      .then(function (response3) {
        //Here we should have recieved client_credentials access token
        //console.log("Access token data client_credentials");
        //console.log(JSON.stringify(response3.data, null, 10));

        var ClientCredToken = response3.data.access_token;
        var ClientCredExpiry = response3.data.expires_in + Date.now(); //Sets variable to the future unix time of expiry in seconds

        //Save all our data to database, use will recieve and error or success message afterwards
        //console.log("Adding to user table");
        if(DBAddUser(UserID, Username) == false){
            console.log("SQL error: adding to twitch users");
            res.send("An error has occured, please try again later.");
            res.status(200).end();
            return;
        };
        //console.log("Added to user table");

        //console.log("Adding to token table");
        if(DBAddTokens(UserID, AuthCodeToken, AuthCodeRefreshToken, AuthCodeTokenExpiry, ClientCredToken, ClientCredExpiry) == false){
            console.log("SQL error: adding to twitch tokens");
            res.send("An error has occured, please try again later.");
            res.status(200).end();
            return;
          };

          //If there was no error then send them a success message and emit the new id
          res.send(`Authentication sucess ${Username}! I will join your channel as soon as possible. <br> <img src="${ProfileImgUrl}">`);
          res.status(200).end();
          dbEmitter.emit('AddedUser', UserID);

      }).catch(function (error) {
        //Error getting client_credentials token
        console.log(error);
        res.send("An error has occured, please try again later.");
        res.status(200).end();
      });
    }).catch(function (error) {
      //Error getting user data using authorization_code token
      console.log(error);
      res.send("An error has occured, please try again later.");
      res.status(200).end();
    });
  }).catch(function (error) {
    //Error getting authorization_code token
    console.log(error);
    res.send("An error has occured, please try again later.");
    res.status(200).end();
  });

});


//Removes user from database
dbEmitter.on('RemovedUser', function (UserID){
  console.log("Deauthorizing user " + UserID);

  db.run(`
    DELETE FROM "twitch_users" WHERE "user_id" = 0;
  `, [], function (error){
    if(error){
      console.log(error);
      return;
    };
    console.log("Deauthed user " + UserID)
  });

});



module.exports = router;
