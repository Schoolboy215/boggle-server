// This module will handle everything related to loading configurations and databases from file and getting ready to run
const { exception } = require('console')
var fs = require('fs')

const sqlite3 = require('sqlite3').verbose()
const readline = require('readline')

// Initialize all our variables to null before loading
var inMemDB     = null
var diskDB      = null
var loaded      = false
var apiToken    = null

// Simple method to make sure that the .env file has all the values we need to run
exports.checkEnv = function(){
    // Set up the list of variables that are mandatory
    const variablesToCheck = [
        "SESSION_SECRET",
        "CERT_PATH",
        "KEY_PATH",
        "PORT",
        "GAME_LENGTH",
        "ROOMCODE_BYTES"
    ]
    var error = false
    // Check each one to see if it's populated
    variablesToCheck.forEach(variable => {
        if (!process.env[variable])
        {
            console.error("Missing .env variable " + variable)
            error = true
        }
    })
    if (error)
    {
        throw new Error(".env file is not fully set up")
    }
}

// Initialization method that we call to load the word database into memory and check the .apiToken file
exports.init = async function(){
    return new Promise( async (resolve,reject) => {
        if (!fs.existsSync('.apiToken'))
            reject("No .apiToken file")
        else
        {
            const stats = fs.statSync('.apiToken')
            const fileSizeInBytes = stats.size
            if (fileSizeInBytes)
            {
                const rs = fs.createReadStream('.apiToken')
                const reader = readline.createInterface({ input: rs })
                const line = await new Promise((resolve) => {
                    reader.on('line', (line) => {
                        reader.close()
                        resolve(line)
                    })
                })
                rs.close()
                this.apiToken = line
                console.log('API token loaded')
            }
            else
            {
                console.warn("API token file is empty. API is not secured")
            }

        }
        // Make sure we either have a dictionary database already or a way to make one
        // This method will also try to generate a new database if it doesn't already exist
        await checkForDict()

        this.diskDB     = new sqlite3.Database('./config/dict.sqlite')
        this.inMemDB    = await createInMemDB()
        this.loaded     = true
        resolve()
    })
}

// Method that gets called after an admin uploads a new dictionary file
// This ensures that new games will have access to the new words immediately without a server restart
exports.refreshAfterImport = async function(){
    return new Promise( async (resolve,reject) => {
        await createDictFromFile()
        this.diskDB = new sqlite3.Database('./config/dict.sqlite')
        this.inMemDB = await createInMemDB()
        this.loaded = true
        resolve()
    })
}

// Method that not only checks for the dictionary existence but tries to make a new one from file if needed
async function checkForDict(){
    return new Promise(async (resolve,reject) => {
        if (fs.existsSync('./config/dict.sqlite')) {
            console.log("Sqlite dictionary was found")
            resolve()
        }
        else
        {
            console.warn("Sqlite dictionary was not found")
            await createDictFromFile()
            resolve()
        }
    })
}

// Method to create a new sqlite database from the dictionary file
// Will fail if there is no dictionary.txt
async function createDictFromFile(){
    // Helper method we'll use in here to load all the lines from the raw text file
    async function readLines(_input) {
        return new Promise(async (resolve, reject) =>{
            var lineReader = require('readline').createInterface({
                input: fs.createReadStream('./config/dictionary.txt')
            })
            var arrayToReturn = new Array()
            lineReader.on('line', (line) => {
                arrayToReturn.push(line)
            })
            lineReader.on('close', () => {
                resolve(arrayToReturn)
            })
        })
    }
    return new Promise(async (resolve,reject) => {
        // We have a dictionary text file so it should be smooth sailing
        if (fs.existsSync('./config/dictionary.txt'))
        {
            console.log("dictionary.txt found. Creating sqlite file")

            let db = new sqlite3.Database('./config/dict.sqlite', (err) => {
                if (err)
                    throw(err)
                else
                    console.log('database file opened')
            })
            db.serialize(function() {
                db.run('CREATE TABLE if not exists words(word text)')
                db.run('CREATE UNIQUE INDEX wordIdx ON words(word)')
                db.run('CREATE TABLE if not exists addWords(word text)')
                db.run('CREATE TABLE if not exists removeWords(word text)')
                db.run('CREATE TABLE if not exists boardHistory(timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)')
                db.run('DELETE FROM words')
            })

            var rawDict         = fs.createReadStream('./config/dictionary.txt')
            var wordsToInsert   = await readLines(rawDict)

            // The wordsToInsert variable should now contain an array with all of the words we want to put in our new database
            // Start inserting them all now as one bulk transaction
            db.serialize(function() {
                db.run("BEGIN TRANSACTION")
                wordsToInsert.forEach((word) => {
                    db.serialize(function() {
                        db.run("INSERT INTO words(word) VALUES(?)",[word])
                    })
                })
                db.run("COMMIT")
            })
            console.log(wordsToInsert.length + " words added to database.")
            db.close()
            db.on('close', () => {
                console.log('database closed')
                rawDict.close()
                console.log("Dict sqlite database created and saved")
                resolve()
            })
        }
        // No dictionary file exists in the config folder. Throw a rejection which will ultimately stop the server
        else
        {
            reject("No dictionary.txt file was found. Place a file with this name in the config directory")
        }
    })
}

// Method to return an in-memory word database generated from the disk based database
async function createInMemDB() {
    mem_db = new sqlite3.Database(':memory:')

    return new Promise (async resolve => {
        mem_db.serialize(function() {
            mem_db.run('CREATE TABLE words(word text)')
            mem_db.run("ATTACH './config/dict.sqlite' AS src")
            mem_db.run("INSERT INTO words SELECT * FROM src.words")
            resolve(mem_db)
        })
    })
}

// Method to return an array of words that start with the passed parameter word
// This is called from the board code while it's generating a new puzzle
exports.findWord = function(word) {
    return new Promise(resolve => {
        var matches = new Array();
        this.inMemDB.all("SELECT word FROM words WHERE word LIKE '" + word + "%'", (err, rows) => {
            resolve(rows.map(row => row.word));
        });
    });
}

// Method to add a word addition request. This will get called directly from the mobile app
// Does some checks to prevent duplicate entries
exports.addWordRequest = async function(words) {
    return new Promise ( async (resolve) => {
        await new Promise( async (resolve) => {
            words.forEach(( word,index, array) => {
                word    = word.toLowerCase()
                var DB  = this.diskDB
                DB.get("SELECT word FROM addWords WHERE word LIKE ?", [word], function(err, row) {
                    if (!row)
                    {
                        DB.get("SELECT word FROM words WHERE word LIKE ?",[word], function(err, row) {
                            if (!row)
                            {
                                DB.run("INSERT INTO addWords(word) VALUES(?)",[word], (err) => {
                                    if (index === array.length -1) resolve()
                                })
                            }
                            else
                            {
                                if (index === array.length -1) resolve()
                            }
                        })
                    }
                    else
                    {
                        if (index === array.length -1) resolve()
                    }
                })
            })
        })
        resolve("Word insertion request processed")
    })   
}

// Method to add a word removal request. This will be called directly from the mobile app
// Does some checks to prevent duplicate entries
exports.removeWordRequest = async function(words) {
    return new Promise ( async (resolve) => {
        await new Promise( async (resolve) => {
            words.forEach(( word,index, array) => {
                word    = word.toLowerCase()
                var DB  = this.diskDB
                DB.get("SELECT word FROM removeWords WHERE word LIKE ?", [word], function(err, row) {
                    if (!row)
                    {
                        DB.get("SELECT word FROM words WHERE word LIKE ?",[word], function(err, row) {
                            if (row)
                            {
                                DB.run("INSERT INTO removeWords(word) VALUES(?)",[word], (err) => {
                                    if (index === array.length -1) resolve()
                                })
                            }
                            else
                            {
                                if (index === array.length -1) resolve()
                            }
                        })
                    }
                    else
                    {
                        if (index === array.length -1) resolve()
                    }
                })
            })
        })
        resolve("Word removal request processed")
    }) 
}

// Method that returns a nice array of all pending addition requests
exports.getAdditionRequests = function() {
    return new Promise (resolve => {
        var words = new Array()
        this.diskDB.all("select word from addWords", (err, rows) => {
            if (rows)
            {
                rows.forEach((row) => {
                    words.push(row.word)
                })
            }
            resolve(words)
        })
    })
}

// Method that returns a nice array of all pending removal requests
exports.getRemovalRequests = function() {
    return new Promise (resolve => {
        var words = new Array()
        this.diskDB.all("select word from removeWords", (err, rows) => {
            if (rows)
            {
                rows.forEach((row) => {
                    words.push(row.word)
                })
            }
            resolve(words)
        })
    })
}

// Method to commit a subset of additions and removals
// Payload comes in as a big list of adds and removes together
exports.processRequests = async function(reqBody) {
    return new Promise (async resolve => {
        // Fill up these arrays from our database
        // These will be used to verify that the incoming request contains only choices that are backed by the data we already have
        var addRequests     = await this.getAdditionRequests()
        var removeRequests  = await this.getRemovalRequests()

        // These are new arrays that we will parse from the request
        var adding      = new Array()
        var removing    = new Array()

        for (var key in reqBody){
            var current = key.split(":")
            if (current[0] == "add" && addRequests.includes(current[1]))
            {
                adding.push(current[1])
            }
            else if(current[0] == "remove" && removeRequests.includes(current[1]))
            {
                removing.push(current[1])
            }
        }
        // Our two arrays should be filled with the user's request now. Time to process them

        // Start with the adding list
        if (adding.length)
        {
            await new Promise(async resolve => {
                adding.forEach((word, index, array) => {
                    this.diskDB.run("INSERT INTO words(word) VALUES(?)", [word], (err) => {
                        if (index === array.length -1) resolve()
                    })
                })
            })
        }

        // Continue with the removal list
        if (removing.length)
        {
            await new Promise(async resolve => {
                removing.forEach((word, index, array) => {
                    this.diskDB.run("DELETE FROM words WHERE word = ?", [word], (err) => {
                        if (index === array.length -1) resolve()
                    })
                })
            })
        }

        // Because we require all actions to be done at once we now clear the tables in the DB
        await new Promise(async resolve => {
            this.diskDB.run("DELETE FROM addWords", (err) => {
                resolve()
            })
        })
        await new Promise(async resolve => {
            this.diskDB.run("DELETE FROM removeWords", (err) => {
                resolve()
            })
        })
        
        // Replace our inMemDB with a fresh one because our diskDB has been changed
        this.inMemDB = await createInMemDB(this.diskDB)
        resolve("finished")
    })
}
exports.getAPIToken = function() {
    return this.apiToken
}
exports.setAPIToken = function(newToken){
    return new Promise( async (resolve,reject) => {
        fs.writeFileSync('.apiToken',newToken)
        if (newToken)
        {
            this.apiToken = newToken
        }
        else
        {
            this.apiToken = null
        }
        resolve()
    })
}
exports.createNewDictFile = function(){
    return new Promise( async (resolve,reject) => {
        if (fs.existsSync('./config/dictionary.txt'))
        {
            fs.unlinkSync('./config/dictionary.txt')
        }
        this.inMemDB.all("select * from words", function(err, rows) {
            var dictString  = rows.reduce((newString, row) => newString + row.word + "\n", "")
            let writeStream = fs.createWriteStream('./config/dictionary.txt')
            writeStream.write(dictString)
            writeStream.end()
            writeStream.on('finish', () => {
                resolve()
            })
        })
    })
}

exports.importDictFile = function(file){
    return new Promise( async (resolve,reject) => {
        if (fs.existsSync('./config/dictionary.txt'))
        {
            fs.unlinkSync('./config/dictionary.txt')
        }
        let writeStream = fs.createWriteStream('./config/dictionary.txt')
        writeStream.write(file["data"])
        writeStream.end()
        writeStream.on('finish', () => {
            resolve()
        })
    })
}

exports.resetStats = async function()
{
    return new Promise (async resolve => {
        this.diskDB.run("DELETE FROM boardHistory", err => {
            resolve()
        })
    })
}

exports.getBoardHistory = async function()
{
    return new Promise( async (resolve,reject) => {
        this.diskDB.get('SELECT timestamp, ROWID FROM boardHistory ORDER BY ROWID DESC LIMIT 1', (err,row) => {
            if (err)
            {
                reject(err)
            }
            else
            {
                if (row)
                {
                    resolve([row['rowid'],row['timestamp']])
                }
                else
                {
                    resolve([0,0])
                }
            }
        })
    })
}