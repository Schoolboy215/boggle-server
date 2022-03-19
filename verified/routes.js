var express = require('express')
var router = express.Router()
var config = require('../config')

//Change request related routes
router.get('/changeRequests', async function(req, res, next) {
    var addRequests = await config.getAdditionRequests()
    var removeRequests = await config.getRemovalRequests()
    res.render('changeRequests', { addRequests: addRequests, removeRequests: removeRequests })
})

router.post('/processChanges', async function(req, res, next) {
    var processResponse = await config.processRequests(req.body)
    req.flash("success_message", "Dictionary changes processed - " + processResponse)
    res.redirect('/')
})

//Settings screen
router.get('/settings', async function(req, res, next) {
    var apiToken = await config.getAPIToken()

    var env = process.env
    var variables = [];
    for (var i = 0; i < config.editableEnvVariables.length; i++) {
        var variable = {}
        variable.name = config.editableEnvVariables[i]
        variable.value = env[config.editableEnvVariables[i]]
        variables.push(variable);
    }
    res.render('settings', { apiToken: apiToken, variables: variables })
})

//Dictionary file related routes
router.get('/dictionaryDownload', async function(req, res, next) {
    await config.createNewDictFile()
    res.download(`config/dictionary.txt`)
})
router.post('/dictionaryUpload', async(req, res) => {
    try {
        if (!req.files) {
            req.flash("error_message", "No file specified")
            res.redirect('./settings')
            return
        } else {
            await config.importDictFile(req.files["dictInput"])
            await config.refreshAfterImport()
            req.flash("success_message", "Done")
            res.redirect('./settings')
        }
    } catch (err) {
        req.flash("error_message", err)
        res.redirect('./settings')
    }
})

//ApiToken related routes
router.post('/apiToken', async(req, res) => {
    try {
        await config.setAPIToken(req.body["apiToken"])
        req.flash("success_message", "Done")
        res.redirect('./settings')
    } catch (err) {
        req.flash("error_message", err)
        res.redirect('./settings')
    }
})

// Stat-related routes
router.post('/resetStats', async(req, res) => {
    try {
        await config.resetStats()
        req.flash("success_message", "Done")

        if (req.wsHandler) {
            // If the request has a websocket handler, we can clear out everyone's home page that is watching
            if (req.wsHandler) {
                // No need to await this call. The person who cleared the stats is already on a different page
                req.wsHandler.updateHomePage()
            }
        }
        res.redirect('./settings')
    } catch (err) {
        req.flash("error_message", err)
        res.redirect('./settings')
    }
})

// .env settings route
router.post('/envVariables', async(req, res) => {
    try {
        for (var i = 0; i < config.editableEnvVariables.length; i++) {
            config.setEnvValue(config.editableEnvVariables[i], req.body[config.editableEnvVariables[i]])
        }
        req.flash("success_message", "Done")
        res.redirect('./settings')
    } catch (err) {

    }
})

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated())
        return next()
    else {
        req.session.redirectTo = req.originalUrl
        res.redirect('/auth/login')
    }
}

function checkAPIToken(req, res, next) {
    if (req.header("api_token") == config.getAPIToken() || (req.header("api_token") == "" && !config.getAPIToken()))
        return next()
    else
        res.status(401).send("Missing or invalid api_token in header")
}

module.exports.router = router
module.exports.ensureAuthenticated = ensureAuthenticated
module.exports.checkAPIToken = checkAPIToken