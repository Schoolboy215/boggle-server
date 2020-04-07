var config = require("../config");

var express = require('express');
var router = express.Router();

router.post("/add", (req,res) => {
    res.status(200).send(config.addWordRequest(req.body))
})
router.post("/remove", (req,res) => {
    res.status(200).send(config.removeWordRequest(req.body))
})

module.exports = router;