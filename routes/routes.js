var appRouter = function(app) {
    app.get("/", (req,res) => {
        res.send("Hello World");
    });

    require("../board/routes.js")(app);
}

module.exports = appRouter;