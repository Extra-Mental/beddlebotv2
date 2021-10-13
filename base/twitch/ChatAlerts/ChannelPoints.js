//Detects channel points being spent via my we bendpoint

const express = require("express");
const router = express.Router();

router.post("/twitch/webhook/redemption", (req, res) => {
  var body = req.body;
  console.log(body);

  //accepting subevent challenge
  if (typeof req.body.challenge !== "undefined") {
    console.log("Accepting challenge");
    res.send(req.body.challenge);
    res.status(200).end();
    return;
  }

  //res.send('ok')
  res.status(200).end();
});

module.exports = router;
