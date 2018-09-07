var Board = require('./board');

var appRouter = function(app) {
    app.get("/boards", (req,res) => {
        res.send("Board section");
    });
    app.get("/boards/create", (req,res) => {
        var b = new Board();
        b.fillSquares();
        res.send(b);
    });
}

module.exports = appRouter;