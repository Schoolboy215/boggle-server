const got = require('got')

exports.getWordDefinition = function(word){
    return new Promise (async resolve => {
        var definitionResult        = {}
        definitionResult['word']    = word
        try {
            const response                  = await got('https://api.dictionaryapi.dev/api/v2/entries/en/' + word)
            const parsedReponse             = JSON.parse(response.body)

            definitionResult['definition']  = parsedReponse[0].meanings[0].definitions[0].definition
            resolve(definitionResult)
        }
        catch(err)
        {
            definitionResult['error'] = err.message
            resolve(definitionResult)
        }
    })
}