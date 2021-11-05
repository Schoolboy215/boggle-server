// This file just makes sure that we have the user database set up and gets the authentication strategy ready

var passport        = require('passport')
  , LocalStrategy   = require('passport-local').Strategy

var crypto          = require('crypto')
var sqlite3         = require('sqlite3')
const fs            = require('fs')

// Function that first checks to see if the user database exists and creates it if not
async function checkOrCreateUserDB()
{
    return new Promise (async (resolve) => {
        if (fs.existsSync('authenticate/users.sqlite')) {
            console.log("User database was found")
            resolve()
        }
        else
        {
            console.warn("Users database was not found")
            let db = new sqlite3.Database('authenticate/users.sqlite', async (err) => {
                if (err)
                    throw(err)
                else
                {
                    await new Promise (async (resolve) => {
                        db.run('CREATE TABLE "users" ( "id" INTEGER PRIMARY KEY AUTOINCREMENT, "username" TEXT, "password" TEXT, "salt" TEXT )', (err) => {
                            db.close()
                            console.log("Users db created")
                            resolve()
                        })
                    })
                    resolve()
                }
            })
        }
    })
}

// Main async function so that we can call this and wait for completion in main.js
async function main()
{
    return new Promise (async resolve => {

        await checkOrCreateUserDB()

        var db = new sqlite3.Database('authenticate/users.sqlite')

        function hashPassword(password, salt) {
            var hash = crypto.createHash('sha256')
            hash.update(password)
            hash.update(salt)
            return hash.digest('hex')
        }

        passport.use(new LocalStrategy(
            {
                usernameField: 'username',
                passwordField: 'password'
            }, function(username, password, done) {
            db.get('SELECT salt FROM users WHERE username = ?', username, function(err, row) {
                if (!row) return done(null, false)
                var hash = hashPassword(password, row.salt)
                db.get('SELECT username, id FROM users WHERE username = ? AND password = ?', username, hash, function(err, row) {
                if (!row)
                    return done(null, false)
                return done(null, row)
                })
            })
        }))
        
        passport.serializeUser(function(user, done) {
            return done(null, user.id)
        })

        passport.deserializeUser(function(id, done) {
            db.get('SELECT id, username FROM users WHERE id = ?', id, function(err, row) {
                if (!row) return done(null, false)
                return done(null, row)
            })
        })
        resolve()
    })
}

// This is the public function we'll call from main.js
exports.init = async function()
{
    return new Promise(async resolve => {
        await main()
        resolve()
    })
}