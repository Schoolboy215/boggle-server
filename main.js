var express = require('express');
var bodyParser = require('body-parser');

const sqlite3 = require('sqlite3').verbose();

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

var config = require('./config');
try{
    config.init().then((result) => {
        console.log(result);
        var routes = require("./routes/routes.js")(app);
        var server = app.listen(3000, () => {
            console.log("Listening on port %s...", server.address().port);
        })
    });
} catch(e) {
    console.error(e);
    return;
}
