var express = require('express');
var bodyParser = require('body-parser');
var hbs = require('express-handlebars');
var sassMiddleware  = require('node-sass-middleware');
var path = require('path');
var passport = require('passport');
var session = require('express-session');
var flash = require('connect-flash');
var ws = require('ws');
var wsHandler = require('./websocketHandler');

require('dotenv').config();
require('./authenticate/init');

//Get server keys for SSL
var https = require('https')
const fs = require('fs');
const key = fs.readFileSync(process.env.KEY_PATH);
const cert = fs.readFileSync(process.env.CERT_PATH);
var credentials = {}

if (process.env.CAPath)
{
    const ca = fs.readFileSync(process.env.CA_PATH);
    credentials = {
        key: key,
        cert: cert,
        ca: ca
    };
}
else
{
    credentials = {
        key: key,
        cert: cert,
    };
}



const sqlite3 = require('sqlite3').verbose();

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use('/stylesheets',sassMiddleware({
    /* Options */
    src: __dirname + '/sass',
    dest: __dirname + '/public/stylesheets',
    debug: true,
    outputStyle: 'expanded'
}));
  
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('hbs', hbs({ 
    extname: 'hbs', 
    defaultLayout: 'main',
    layoutsDir: __dirname + '/views/layouts/',
    partialsDir: __dirname + '/views/partials/'
}));
app.set('view engine', 'hbs');

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: { secure: true }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(function(req, res, next){
    res.locals.success_message = req.flash('success_message');
    res.locals.error_message = req.flash('error_message');
    res.locals.user = req.user;
    next();
});

app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'allow' }));

var config = require('./config');

// Routing
var indexRouter = require('./routes/index');
var boardRouter = require('./board/routes');
var configRouter = require('./config/routes');
var authRouter = require('./authenticate/routes');
var verifiedRouter = require('./verified/routes');

app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/api/boards', verifiedRouter.checkAPIToken, boardRouter);
app.use('/api/words', verifiedRouter.checkAPIToken, configRouter);
app.use('/verified', verifiedRouter.ensureAuthenticated, verifiedRouter.router);

try{
    config.init().then((result) => {
        console.log(result);

        const server = https.createServer(credentials, app);
        server.listen(process.env.PORT, function () {
            console.log('listening on port ' + process.env.PORT.toString())
        });

        const wss = new ws.Server({ server });
        var handler = new wsHandler.wsHandler();
        wss.on('connection', (socket) => {
            handler.handleConnection(socket);
        });
    });
} catch(e) {
    console.error(e);
    return;
}
