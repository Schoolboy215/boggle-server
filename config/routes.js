var config = require("../config");

var appRouter = function(app) {
    app.post("/words/add", (req,res) => {
        res.status(200).send(config.addWordRequest(req.body))
    })
    app.post("/words/remove", (req,res) => {
        res.status(200).send(config.removeWordRequest(req.body))
    })
}

module.exports = appRouter;