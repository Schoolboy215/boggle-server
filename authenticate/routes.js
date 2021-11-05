var express     = require('express')
var passport    = require('passport')

const router        = express.Router()
const signupHandler = require('./signupHandler')

router.post('/login', passport.authenticate('local', {failureRedirect: '/auth/login'}), (req,res) => {
    // Save a copy of where the user was trying to go so we can clear it
    var redirectTo = req.session.redirectTo || '/'
    delete req.session.redirectTo
    // Send them where they were trying to go
    res.redirect(redirectTo)
})
router.post('/signup', async function(req, res) {
    // Check to see if there isn't a user account yet. Only then are we able to make a new signup
    var noUsers = await signupHandler.checkIfNoUsers()
    if (noUsers)
    {
        try{
            var result = await signupHandler.addUser(req.body["username"], req.body["password"])
            res.redirect('/')
        }
        catch(err)
        {
            req.flash('error_message', err)
            res.redirect(301, '/auth/login')
        }
        
    }
    else
    {
        req.flash('error_message', 'You cannot create a new account because one already exists.')
        res.redirect(301, '/auth/login')
    }
})

// Routes called from the login page on the frontend
router.get('/login', function(req, res) {
    res.render('login')
})

router.get('/logout', function(req,res) {
    req.logout()
    res.redirect('/')
})


module.exports = router