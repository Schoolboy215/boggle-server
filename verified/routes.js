var express = require('express');
var router = express.Router();
var config = require('../config');

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

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated())
        return next();
    else{
        req.session.redirectTo = req.originalUrl;
        res.redirect('/auth/login')
    }
}

module.exports.router = router;
module.exports.ensureAuthenticated = ensureAuthenticated;