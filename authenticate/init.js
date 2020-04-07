var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy;

var crypto = require('crypto');
var sqlite3 = require('sqlite3');
const fs = require('fs');

if (fs.existsSync('authenticate/users.sqlite')) {
    console.log("User database was found");
}
else
{
    console.warn("Users database was not found");
    let db = new sqlite3.Database('authenticate/users.sqlite', (err) => {
        if (err)
            throw(err);
        else
        {
            console.log('database file opened');
            db.run('CREATE TABLE "users" ( "id" INTEGER PRIMARY KEY AUTOINCREMENT, "username" TEXT, "password" TEXT, "salt" TEXT )');
            db.close();
            console.log("Users db created");
        }
    });
}

var db = new sqlite3.Database('authenticate/users.sqlite');

function hashPassword(password, salt) {
    var hash = crypto.createHash('sha256');
    hash.update(password);
    hash.update(salt);
    return hash.digest('hex');
}

passport.use(new LocalStrategy(
    {
        usernameField: 'username',
        passwordField: 'password'
    }, function(username, password, done) {
    db.get('SELECT salt FROM users WHERE username = ?', username, function(err, row) {
        if (!row) return done(null, false);
        var hash = hashPassword(password, row.salt);
        db.get('SELECT username, id FROM users WHERE username = ? AND password = ?', username, hash, function(err, row) {
        if (!row)
            return done(null, false);
        return done(null, row);
        });
    });
}));
  
passport.serializeUser(function(user, done) {
    return done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    db.get('SELECT id, username FROM users WHERE id = ?', id, function(err, row) {
        if (!row) return done(null, false);
        return done(null, row);
    });
});