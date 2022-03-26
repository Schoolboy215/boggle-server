var express     = require('express')
var passport    = require('passport')

const router        = express.Router()

// Routes called from the login page on the frontend
router.get('/singlePlayer', function(req, res) {
    res.render('browserPlay_AI')
})

module.exports = router