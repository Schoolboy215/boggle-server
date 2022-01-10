var express = require('express')
const got = require('got')
var router = express.Router()

/* GET home page. */
router.get('/', async function(req, res, next) {
    const response          = await got('https://api.github.com/repos/Schoolboy215/boggle-client/releases/latest')
    const parsedResponse     = JSON.parse(response.body)
    if (parsedResponse["assets"][0]["browser_download_url"])
    {
        res.render('index',{latest_download_url:parsedResponse["assets"][0]["browser_download_url"]})
    }
    else
    {
        res.render('index')
    }
})

module.exports = router