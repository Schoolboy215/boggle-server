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

router.get("/create/:quantity", async (req,res) => {
    var boards = []

    if (parseInt(req.params.quantity) > parseInt(process.env.MAX_MULTIBOARD_GEN))
    {
        res.status(400).send("Multi-board request exceeds server maximum of " + process.env.MAX_MULTIBOARD_GEN)
    }
    else
    {
        for (var i = 0; i < req.params.quantity; i++)
        {
            var b = new Board()
            b.fillSquares()
            await b.solveBoard()
            boards.push(b)
            // If the request has a websocket handler, we can get some fresh history info and push it out to them
            if (req.wsHandler)
            {
                // No need to await this call. The client requesting the board shouldn't be delayed
                req.wsHandler.updateHomePage()
            }
        }
        res.send(boards)
    }
})

module.exports = router