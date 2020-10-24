const { exception } = require('console');
var fs = require('fs');

const sqlite3 = require('sqlite3').verbose();
const readline = require('readline');

var inMemDB = null;
var diskDB = null;
var loaded = false;
var apiToken = null;

exports.checkEnv = function(){
    const variablesToCheck = [
        "SESSION_SECRET",
        "CERT_PATH",
        "KEY_PATH",
        "PORT",
        "GAME_LENGTH",
        "ROOMCODE_BYTES"
    ]
    var error = false;
    variablesToCheck.forEach(variable => {
        if (!process.env[variable])
        {
            console.error("Missing .env variable " + variable);
            error = true;
        }
    });
    if (error)
    {
        throw new Error(".env file is not fully set up");
    }
}

exports.init = function(){
    return new Promise( async (resolve,reject) => {
        if (!fs.existsSync('.apiToken'))
            reject("No .apiToken file");
        else
        {
            const stats = fs.statSync('.apiToken');
            const fileSizeInBytes = stats.size;
            if (fileSizeInBytes)
            {
                const rs = fs.createReadStream('.apiToken');
                const reader = readline.createInterface({ input: rs });
                const line = await new Promise((resolve) => {
                    reader.on('line', (line) => {
                        reader.close();
                        resolve(line);
                    });
                });
                rs.close();
                this.apiToken = line;
                console.log('API token loaded');
            }
            else
            {
                console.warn("API token file is empty. API is not secured");
            }

        }
        checkForDict().then((result) => {
            this.diskDB = new sqlite3.Database('./config/dict.sqlite');
            createInMemDB(this.diskDB).then( (db) => {
                this.inMemDB = db;
                this.loaded = true;
                resolve(result);
            });
        });
    });
}
exports.refreshAfterImport = function(){
    return new Promise( async (resolve,reject) => {
        await createDictFromFile();
        this.diskDB = new sqlite3.Database('./config/dict.sqlite');
        createInMemDB(this.diskDB).then( (db) => {
            this.inMemDB = db;
            this.loaded = true;
            resolve();
        });
    });
}
function checkForDict(){
    return new Promise((resolve,reject) => {
        if (fs.existsSync('./config/dict.sqlite')) {
            resolve("Sqlite dictionary was found");
        }
        else
        {
            console.warn("Sqlite dictionary was not found");
            createDictFromFile().then((result) => {
                resolve(result);
            });
        }
    });
}
function createDictFromFile(){
    function readLines(_input) {
        return new Promise(function(resolve, reject) {
            var lineReader = require('readline').createInterface({
                input: fs.createReadStream('./config/dictionary.txt')
            });
            var arrayToReturn = new Array();
            lineReader.on('line', (line) => {
                arrayToReturn.push(line);
            });
            lineReader.on('close', () => {
                resolve(arrayToReturn);
            });
        });
    }
    return new Promise((resolve,reject) => {
        if (fs.existsSync('./config/dictionary.txt'))
        {
            console.log("dictionary.txt found. Creating sqlite file");

            let db = new sqlite3.Database('./config/dict.sqlite', (err) => {
                if (err)
                    throw(err);
                else
                    console.log('database file opened');
            });
            db.serialize(function() {
                db.run('CREATE TABLE if not exists words(word text)');
                db.run('CREATE TABLE if not exists addWords(word text)');
                db.run('CREATE TABLE if not exists removeWords(word text)');
                db.run('DELETE FROM words');
            });

            var rawDict = fs.createReadStream('./config/dictionary.txt');
            var wordsToInsert = new Array();

            readLines(rawDict).then((results) => {
                wordsToInsert = results;
                db.serialize(function() {
                    db.run("BEGIN TRANSACTION");
                    wordsToInsert.forEach((word) => {
                        db.serialize(function() {
                            db.run("INSERT INTO words(word) VALUES('"+word+"')");
                        });
                    });
                    db.run("COMMIT");
                });
                console.log(wordsToInsert.length + " words added to database.");
                db.close();
                db.on('close', () => {
                    console.log('database closed');
                    rawDict.close();
                    resolve("Dict sqlite database created and saved");
                });
            });
        }
        else
            reject("No dictionary.txt file was found. Place a file with this name in the config directory");
    });
}
function createInMemDB(_diskDB) {
    mem_db = new sqlite3.Database(':memory:');

    return new Promise (resolve => {
        mem_db.serialize(function() {
            mem_db.run('CREATE TABLE words(word text)');
            mem_db.run("ATTACH './config/dict.sqlite' AS src;");
            mem_db.run("INSERT INTO words SELECT * FROM src.words");
            resolve(mem_db);
        });
    });
}
exports.findWord = function(word) {
    return new Promise(resolve => {
        var matches = new Array();
        this.inMemDB.all("select word from words where word like '" + word + "%'", (err, rows) => {
            resolve(rows.map(row => row.word));
        });
    });
}
exports.addWordRequest = function(words) {
    words.forEach(word => {
        word = word.toLowerCase()
        this.diskDB.run("INSERT INTO addWords(word) VALUES('" + word +"')");
    })
    return "Word insertion request processed";
}
exports.removeWordRequest = function(words) {
    words.forEach(word => {
        word = word.toLowerCase()
        this.diskDB.run("INSERT INTO removeWords(word) VALUES('" + word +"')");
    })
    return "Word removal request processed";
}
exports.getAdditionRequests = function() {
    return new Promise (resolve => {
        var words = new Array();
        this.diskDB.all("select word from addWords", (err, rows) => {
            if (rows)
            {
                rows.forEach((row) => {
                    words.push(row.word);
                });
            }
            resolve(words);
        });
    });
}
exports.getRemovalRequests = function() {
    return new Promise (resolve => {
        var words = new Array();
        this.diskDB.all("select word from removeWords", (err, rows) => {
            if (rows)
            {
                rows.forEach((row) => {
                    words.push(row.word);
                });
            }
            resolve(words);
        });
    });
}
exports.processRequests = function(reqBody) {
    return new Promise (async resolve => {
        var addRequests     = await this.getAdditionRequests();
        var removeRequests  = await this.getRemovalRequests();
        var adding = new Array();
        var removing = new Array();
        for (var key in reqBody){
            var current = key.split(":");
            if (current[0] == "add" && addRequests.includes(current[1]))
            {
                adding.push(current[1]);
            }
            else if(current[0] == "remove" && removeRequests.includes(current[1]))
            {
                removing.push(current[1]);
            }
        }
        adding.forEach(word => {
            this.diskDB.run("INSERT INTO words(word) VALUES('" + word +"')");
        });
        removing.forEach(word => {
            this.diskDB.run("DELETE FROM words WHERE word = '" + word +"'");
        });
        this.diskDB.run("DELETE FROM addWords");
        this.diskDB.run("DELETE FROM removeWords");
        
        this.inMemDB = await createInMemDB(this.diskDB);
        resolve("finished");
    });
}
exports.getAPIToken = function() {
    return this.apiToken;
}
exports.createNewDictFile = function(){
    return new Promise( async (resolve,reject) => {
        if (fs.existsSync('./config/dictionary.txt'))
        {
            fs.unlinkSync('./config/dictionary.txt');
        }
        this.inMemDB.all("select * from words", function(err, rows) {
            var dictString = rows.reduce((newString, row) => newString + row.word + "\n", "");
            let writeStream = fs.createWriteStream('./config/dictionary.txt');
            writeStream.write(dictString);
            writeStream.end();
            writeStream.on('finish', () => {
                resolve();
            });
        });
    });
}
exports.importDictFile = function(file){
    return new Promise( async (resolve,reject) => {
        if (fs.existsSync('./config/dictionary.txt'))
        {
            fs.unlinkSync('./config/dictionary.txt');
        }
        let writeStream = fs.createWriteStream('./config/dictionary.txt');
        writeStream.write(file["data"]);
        writeStream.end();
        writeStream.on('finish', () => {
            resolve();
        });
    });
}