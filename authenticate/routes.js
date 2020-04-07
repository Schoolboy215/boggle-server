var express = require('express');
var passport = require('passport');

const router = express.Router();
const signupHandler = require('./signupHandler');

router.post('/login', passport.authenticate('local', {failureRedirect: '/auth/login'}), (req,res) => {
    var redirectTo = req.session.redirectTo || '/';
    delete req.session.redirectTo;
    res.redirect(redirectTo);
});

router.post('/signup', async function(req, res) {
    var noUsers = await signupHandler.checkIfNoUsers();
    if (noUsers)
    {
        var result = await signupHandler.addUser(req.body["username"], req.body["password"]);
        res.redirect('/');
    }
    else
    {
        req.flash('error_message', 'You cannot create a new account because one already exists.');
        res.redirect(301, '/auth/login');
    }
});

router.get('/login', function(req, res) {
    res.render('login');
});

router.get('/logout', function(req,res) {
    req.logout();
    res.redirect('/');
});


module.exports = router;