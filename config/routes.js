var config = require("../config")

var express = require('express')
var router = express.Router()

router.post("/add", async (req,res) => {
    res.status(200).send(await config.addWordRequest(req.body))
})
router.post("/remove", async (req,res) => {
    res.status(200).send(await config.removeWordRequest(req.body))
})

module.exports = router