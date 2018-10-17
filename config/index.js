var fs = require('fs');

const sqlite3 = require('sqlite3').verbose();

exports.init = function(){
    return new Promise((resolve,reject) => {
        checkForDict().then((result) => {
            resolve(result);
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
function createInMemoryCopyOfDB(disk_db, new_db){
    return new Promise((resolve,reject) => {
        disk_db.get("SELECT COUNT(*) FROM WORDS", (err,row) => {
            var waitFor = row["COUNT(*)"];
            var doneSoFar = 0;
            
            new_db.run('CREATE TABLE words(word text)');
            new_db.serialize(function() {
                new_db.run("BEGIN TRANSACTION");
                disk_db.each('select * from words', (err, row) => {
                    new_db.serialize(function() {
                        new_db.run("INSERT INTO words(word) VALUES('" + row.word+"')");
                        doneSoFar++;
                    });
                    if (doneSoFar == waitFor)
                    {
                        new_db.run("COMMIT");
                        resolve("done");
                    }
                });
            });
        });
    });
}
exports.testDB = function(word){
    return new Promise((resolve, reject) => {
        let old_db = new sqlite3.Database('./config/dict.sqlite');
        let new_db = new sqlite3.Database(':memory:');
        createInMemoryCopyOfDB(old_db,new_db).then((result) => {
            var matches = new Array();
            new_db.all("select word from words where word like '" + word + "%'", (err, rows) => {
                rows.forEach((row) => {
                    matches.push(row.word);
                });
                resolve(matches);
            });
        }); 
    });
}