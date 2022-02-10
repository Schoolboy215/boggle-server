const got = require('got')
var config = require("../config")

exports.getWordDefinition = function(word) {
    return new Promise(async resolve => {
        if (process.env["MERRIAM_WEBSTER_API_KEY"]) {
            var definitionResult = {}
            definitionResult['word'] = word
            try {
                const response = await got('https://www.dictionaryapi.com/api/v3/references/collegiate/json/' + word + '?key=' + process.env["MERRIAM_WEBSTER_API_KEY"])
                const parsedResponse = JSON.parse(response.body)
                var shortDefs = parsedResponse[0].shortdef
                definitionResult['definition'] = ''

                for (var i = 0; i < shortDefs.length; i++) {
                    definitionResult['definition'] += shortDefs[i] + '\n'
                }

                definitionResult['definition'] = definitionResult['definition'].slice(0, -1)

                resolve(definitionResult)
            } catch (err) {
                definitionResult['error'] = err.message
                resolve(definitionResult)
            }
        } else {
            var definitionResult = {}
            definitionResult['word'] = word
            try {
                const response = await got('https://api.dictionaryapi.dev/api/v2/entries/en/' + word)
                const parsedReponse = JSON.parse(response.body)

                definitionResult['definition'] = parsedReponse[0].meanings[0].definitions[0].definition
                resolve(definitionResult)
            } catch (err) {
                definitionResult['error'] = err.message
                resolve(definitionResult)
            }
        }
    })
}