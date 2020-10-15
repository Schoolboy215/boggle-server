var express = require('express');
var router = express.Router();
var config = require('../config');

//Change request related routes
router.get('/changeRequests', async function(req,res,next) {
    var addRequests     = await config.getAdditionRequests();
    var removeRequests  = await config.getRemovalRequests();
    res.render('changeRequests', {addRequests: addRequests, removeRequests: removeRequests});
});

router.post('/processChanges', async function(req,res,next) {
    var processResponse = await config.processRequests(req.body);
    req.flash("success_message", "Dictionary changes processed - " + processResponse);
    res.redirect('/');
});

//Dictionary file related routes
router.get('/dictionaryDownload', async function(req,res,next) {
    await config.createNewDictFile();
    res.download(`config/dictionary.txt`);
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated())
        return next();
    else{
        req.session.redirectTo = req.originalUrl;
        res.redirect('/auth/login')
    }
}

function checkAPIToken(req, res, next) {
    if (req.header("api_token") == config.getAPIToken() || (req.header("api_token") == "" && !config.getAPIToken()))
        return next();
    else
        res.status(401).send("Missing or invalid api_token in header");
}

module.exports.router = router;
module.exports.ensureAuthenticated = ensureAuthenticated;
module.exports.checkAPIToken = checkAPIToken;