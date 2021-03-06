var Board = require('./board');

var express = require('express');
var router = express.Router();

router.get("/", (req,res) => {
    res.send("Board section");
});
router.get("/create", async (req,res) => {
    var b = new Board();
    b.fillSquares();
    await b.solveBoard();
    res.send(b);
});

module.exports = router;