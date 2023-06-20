// Load modules
var express         = require('express')
var hbs             = require('express-handlebars')
var sassMiddleware  = require('node-sass-middleware')
var path            = require('path')
var passport        = require('passport')
var session         = require('express-session')
var flash           = require('connect-flash')
var ws              = require('ws')
var fileUpload      = require('express-fileupload')
const sqlite3       = require('sqlite3').verbose()

// Load custom objects here
var wsHandler       = require('./websocketHandler')
var config          = require('./config')
var auth            = require('./authenticate')

// Set up our .env configuration
config.checkEnv()
require('dotenv').config()

var https       = require('https')
var http        = require('http')
const fs        = require('fs')
//Get server keys for SSL
var key
var cert
var credentials
if (process.env.SKIP_TLS == 0)
{
    key       = fs.readFileSync(process.env.KEY_PATH)
    cert      = fs.readFileSync(process.env.CERT_PATH)
    credentials = {}
}

// Only load certificate info if we're not skipping TLS
if (process.env.SKIP_TLS == 0)
{
    // If the certificate is real and signed by a certificate authority we need to set the credentials to include that
    if (process.env.CAPath)
    {
        const ca = fs.readFileSync(process.env.CA_PATH)
        credentials = {
            key:    key,
            cert:   cert,
            ca:     ca
        }
    }
    // No CA (probably some self-signed thing)
    else
    {
        credentials = {
            key:    key,
            cert:   cert,
        }
    }
}

// Start getting routing and other site stuff running
var app = express()

// enable files upload
app.use(fileUpload({
    createParentPath: true
}))

// get routing started
app.use(express.json())
app.use(express.urlencoded({extended:true}))

// Set up SASS stuff
app.use('/stylesheets',sassMiddleware({
    src:            __dirname + '/sass',
    dest:           __dirname + '/public/stylesheets',
    debug:          true,
    outputStyle:    'expanded'
}))
  
// View engine setup
app.set('views', path.join(__dirname, 'views'))
app.engine('hbs', hbs.engine({ 
    extname:        'hbs', 
    defaultLayout:  'main',
    layoutsDir:     __dirname + '/views/layouts/',
    partialsDir:    __dirname + '/views/partials/'
}))
app.set('view engine', 'hbs')

// Get session secret set up
app.use(session({
    secret:             process.env.SESSION_SECRET,
    resave:             true,
    saveUninitialized:  true,
    // Only use secure cookies if we're doing TLS
    cookie:             { secure: process.env.SKIP_TLS == 0 ? true : false},
}))

// Hook our authentication up to the site
app.use(passport.initialize())
app.use(passport.session())
app.use(flash())

// Make sure that all requests run through and keep track of the user
app.use(function(req, res, next){
    res.locals.success_message  = req.flash('success_message')
    res.locals.error_message    = req.flash('error_message')
    res.locals.user             = req.user
    next()
})

// Ensure that public things like stylesheets are available
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'allow' }))

//Expose our node_module versions of js libraries
app.use("/bootstrap",express.static(__dirname + '/node_modules/bootstrap/dist'))
app.use("/bootstrap-fileInput",express.static(__dirname + '/node_modules/bootstrap-fileinput/js'))
app.use("/jquery",express.static(__dirname + '/node_modules/jquery/dist'))

// Routing setup that we call after authorization has been initialized
loadRoutes = function()
{
    var indexRouter         = require('./routes/index')
    var boardRouter         = require('./board/routes')
    var configRouter        = require('./config/routes')
    var authRouter          = require('./authenticate/routes')
    var verifiedRouter      = require('./verified/routes')
    var definitionRouter    = require('./definitionAPI/routes')
    var browserPlayRouter   = require('./browserPlay/routes')

    app.use('/',                indexRouter)
    app.use('/auth',            authRouter)
    app.use('/api/boards',      verifiedRouter.checkAPIToken, boardRouter)
    app.use('/api/words',       verifiedRouter.checkAPIToken, configRouter)
    app.use('/verified',        verifiedRouter.ensureAuthenticated, verifiedRouter.router)
    app.use('/api/definitions', verifiedRouter.checkAPIToken, definitionRouter)
    app.use('/browserPlay',     browserPlayRouter)
}

// This is the start method that we will call next
const startServer = async function()
{
    try
    {
        // Initialize authentication stuff
        await auth.init()

        loadRoutes()

        await config.init().catch( (reason) => {
            console.error(reason)
        })

        // Start the regular server
        var server;
        if (process.env.SKIP_TLS == 1)
        {
            server = http.createServer(app)
        }
        else
        {
            server = https.createServer(credentials, app)
        }
        
        server.listen(process.env.PORT, function () {
            console.log('listening on port ' + process.env.PORT.toString())
        })

        // Start the websocket server
        const wss = new ws.Server({ server })

        // This is our custom handler. See that module for details
        var handler = new wsHandler.wsHandler()
        wss.on('connection', (socket) => {
            handler.handleConnection(socket)
        })
        
        // We use this event to attach our websocket handler to any incoming request in case they need to push out messages
        server.on('request', (req) => {
            req.wsHandler = handler
        })
    }
    catch(e)
    {
        console.error(e)
        return
    }
}

// Time to actually start things
startServer()
