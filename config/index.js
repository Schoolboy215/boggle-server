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
exports.findWord = function(word){
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