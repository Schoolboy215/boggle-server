// This class is for interacting with the user database
var crypto  = require('crypto')
var sqlite3 = require('sqlite3')

var db = new sqlite3.Database('authenticate/users.sqlite')

function hashPassword(password, salt) {
    var hash = crypto.createHash('sha256')
    hash.update(password)
    hash.update(salt)
    return hash.digest('hex')
}

function checkIfNoUsers() {
    return new Promise((resolve, reject) => {
        db.get("SELECT COUNT(*) FROM users", (err, rows) => {
            if (rows["COUNT(*)"] == 0)
                resolve(true)
            else
                resolve(false)
        })
    })
}

function addUser(username, password) {
    return new Promise((resolve, reject) => {
        if (username == '' || password == '')
        {
            reject("Username and password must be populated")
        }
        else
        {
            var salt        = crypto.randomBytes(8).toString('hex')
            var hashedPass  = hashPassword(password, salt)

            db.run('INSERT INTO users(username, password, salt) VALUES(?,?,?)', [username, hashedPass, salt], (err,rows) => {
                resolve("User created")
            })
        }
    })
}

exports.checkIfNoUsers  = checkIfNoUsers
exports.addUser         = addUser