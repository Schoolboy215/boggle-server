var Board   = require('./board')

var express = require('express')
var router  = express.Router()

router.get("/create", async (req,res) => {
    var b = new Board()
    b.fillSquares()
    await b.solveBoard()

    // If the request has a websocket handler, we can get some fresh history info and push it out to them
    if (req.wsHandler)
    {
        // No need to await this call. The client requesting the board shouldn't be delayed
        req.wsHandler.updateHomePage()
    }
    res.send(b)
})

module.exports = router