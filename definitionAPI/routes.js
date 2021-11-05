var definitions = require("../definitionAPI")
var express     = require('express')
var router      = express.Router()

router.get("/define/:word", async function(req,res){
    if (!req.params['word'])
    {
        res.status(400).send("Malformed definition path")
    }
    var definition = await definitions.getWordDefinition(req.params['word'])
    res.status(200).send(definition)
})

module.exports = router