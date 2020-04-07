var fs = require('fs');

const sqlite3 = require('sqlite3').verbose();

var inMemDB = null;
var diskDB = null;
var loaded = false;

exports.init = function(){
    return new Promise((resolve,reject) => {
        checkForDict().then((result) => {
            createInMemDB().then( (db) => {
                this.inMemDB = db;
                this.loaded = true;
                this.diskDB = new sqlite3.Database('./config/dict.sqlite');
                resolve(result);
            });
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
            db.run('CREATE TABLE words(word text)');
            db.run('CREATE TABLE addWords(word text)');
            db.run('CREATE TABLE removeWords(word text)')

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
                console.log('database closed');
                resolve("Dict sqlite database created and saved");
            });
        }
        else
            reject("No dictionary.txt file was found. Place a file with this name in the config directory");
    });
}
function createInMemDB() {
    disk_db = new sqlite3.Database('./config/dict.sqlite');
    mem_db = new sqlite3.Database(':memory:');

    return new Promise (resolve => {
        mem_db.serialize(function() {
            mem_db.run('CREATE TABLE words(word text)');
            mem_db.run("BEGIN TRANSACTION");
            disk_db.all("select * from words", function(err, rows) {
                rows.forEach(function (row) {
                    mem_db.run("INSERT INTO words(word) VALUES('" + row.word+"')");
                })
                mem_db.run("COMMIT");
                resolve(mem_db);
            });	
        });
    });
}
exports.findWord = function(word) {
    return new Promise(resolve => {
        var matches = new Array();
        this.inMemDB.all("select word from words where word like '" + word + "%'", (err, rows) => {
            rows.forEach((row) => {
                matches.push(row.word);
            });
            resolve(matches);
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
        
        await createInMemDB();
        resolve("finished");
    });
}