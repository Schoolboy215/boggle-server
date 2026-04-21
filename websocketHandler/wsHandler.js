var crypto          = require("crypto")
var Board           = require('../board/board')
var Ajv             = require('ajv')
require('dotenv').config()
var config          = require("../config")
var definitionAPI   = require('../definitionAPI')

var ajv                     = new Ajv({ allErrors: true })
var messageSchema           = require('./schemas/message.json')
var createRoomDataSchema    = require('./schemas/createRoomData.json')
var joinRoomDataSchema      = require('./schemas/joinRoom.json')
var foundWordsDataSchema    = require('./schemas/foundWords.json')

const HOME_PAGE_ROOM = 'homePage'

class clientResponse {
    constructor() {
        this.status = "ok"
        this.event  = ""
        this.data   = ""
    }
}

module.exports = class wsHandler {
    constructor() {
        this.connections        = []
        this.currentGames       = {}
        this.validateMessage    = ajv.compile(messageSchema)
        this.validateCreateRoom = ajv.compile(createRoomDataSchema)
        this.validateJoinRoom   = ajv.compile(joinRoomDataSchema)
        this.validateFoundWords = ajv.compile(foundWordsDataSchema)
        this.apiToken           = config.getAPIToken()
    }

    handleConnection(socket, request) {
        if (this.apiToken) {
            const url   = new URL(request.url, 'http://localhost')
            const token = url.searchParams.get('token')
            socket.authenticated = (token === this.apiToken)
        } else {
            socket.authenticated = true
        }

        socket.id = crypto.randomBytes(8).toString('hex')
        socket.send(socket.id)
        this.connections.push(socket)

        socket.on('close', () => this.handleClose(socket))
        socket.on('message', (message) => this.handleMessage(socket, message))
    }

    handleClose(socket) {
        var index = this.connections.indexOf(socket)
        this.connections.splice(index, 1)

        if (socket.roomCode && socket.roomCode !== HOME_PAGE_ROOM) {
            this.handleDepartingSocket(socket, socket.roomCode)
        }
    }

    async handleMessage(socket, message) {
        var messageResponse = new clientResponse()

        var parsedMessage, parsedData
        try {
            parsedMessage   = JSON.parse(message)
            parsedData      = (parsedMessage.data && typeof parsedMessage.data === 'object') ? parsedMessage.data : null
        } catch (err) {
            createErrorMessage(messageResponse, err.message)
            socket.send(JSON.stringify(messageResponse))
            return
        }

        if (!this.validateMessage(parsedMessage)) {
            createErrorMessage(messageResponse, this.validateMessage.errors)
            socket.send(JSON.stringify(messageResponse))
            return
        }

        var messageType = parsedMessage.event

        if (!socket.authenticated && messageType !== 'boardHistoryCount') {
            createErrorMessage(messageResponse, "Authentication required. Connect with ?token=<your_token> as a query parameter.")
            socket.send(JSON.stringify(messageResponse))
            return
        }

        try {
            switch (messageType) {
                case 'createRoom':            await this.handleCreateRoom(socket, parsedData, messageResponse);  break
                case 'joinRoom':              await this.handleJoinRoom(socket, parsedData, messageResponse);    break
                case 'leaveRoom':             await this.handleLeaveRoom(socket, messageResponse);               break
                case 'startGame':             await this.handleStartGame(socket, messageResponse);               break
                case 'foundWords':            await this.handleFoundWords(socket, parsedData, messageResponse);  break
                case 'boardHistoryCount':     await this.handleBoardHistoryCount(socket);                        break
                case 'browserPlay_soloBoard': await this.handleBrowserPlaySoloBoard(socket);                     break
                case 'definition':            await this.handleDefinition(socket, parsedData);                   break
                default:
                    createErrorMessage(messageResponse, "Message type not recognized")
                    socket.send(JSON.stringify(messageResponse))
            }
        } catch (err) {
            console.log("Error during message process: " + err)
        }
    }

    async handleCreateRoom(socket, parsedData, messageResponse) {
        if (!parsedData || !this.validateCreateRoom(parsedData)) {
            createErrorMessage(messageResponse, parsedData ? this.validateCreateRoom.errors : "This message type requires data")
            socket.send(JSON.stringify(messageResponse))
            return
        }
        if (socket.roomCode) {
            createErrorMessage(messageResponse, "Connection already has a room code")
        } else {
            socket.roomCode         = crypto.randomBytes(parseInt(process.env.ROOMCODE_BYTES)).toString('hex')
            socket.name             = parsedData.name
            messageResponse.event   = "roomCode"
            messageResponse.data    = socket.roomCode
        }
        socket.send(JSON.stringify(messageResponse))
    }

    async handleJoinRoom(socket, parsedData, messageResponse) {
        if (!parsedData || !this.validateJoinRoom(parsedData)) {
            createErrorMessage(messageResponse, parsedData ? this.validateJoinRoom.errors : "This message type requires data")
            socket.send(JSON.stringify(messageResponse))
            return
        }
        if (socket.roomCode) {
            createErrorMessage(messageResponse, "Connection is already in a room")
            socket.send(JSON.stringify(messageResponse))
            return
        }

        socket.name = parsedData.name
        for (const connection of this.connections) {
            if (connection.roomCode && connection.roomCode === parsedData.roomCode && connection !== socket) {
                socket.roomCode = parsedData.roomCode
                var joinNotification    = new clientResponse()
                joinNotification.event  = "joinNotification"
                joinNotification.data   = { name: socket.name }
                connection.send(JSON.stringify(joinNotification))
            }
        }

        messageResponse.event = socket.roomCode ? "joinSuccess" : "error"
        if (!socket.roomCode) {
            createErrorMessage(messageResponse, "Room code not found")
        }
        socket.send(JSON.stringify(messageResponse))
    }

    async handleLeaveRoom(socket, messageResponse) {
        if (!socket.roomCode) {
            createErrorMessage(messageResponse, "Connection is not in a room")
            socket.send(JSON.stringify(messageResponse))
            return
        }

        var oldRoomCode = socket.roomCode
        socket.roomCode = null

        if (oldRoomCode !== HOME_PAGE_ROOM) {
            this.handleDepartingSocket(socket, oldRoomCode)
            var leaveNotification   = new clientResponse()
            leaveNotification.event = "leaveNotification"
            leaveNotification.data  = { name: socket.name }
            await this.sendToWholeRoom(oldRoomCode, leaveNotification)
        }

        messageResponse.event = "leaveSuccess"
        socket.send(JSON.stringify(messageResponse))
    }

    async handleStartGame(socket, messageResponse) {
        if (!socket.roomCode) {
            createErrorMessage(messageResponse, "Connection is not in a room")
            socket.send(JSON.stringify(messageResponse))
            return
        }
        if (this.currentGames[socket.roomCode] && this.currentGames[socket.roomCode].inProgress) {
            createErrorMessage(messageResponse, "Game still in progress")
            socket.send(JSON.stringify(messageResponse))
            return
        }

        var b = new Board()
        b.fillSquares()
        await b.solveBoard()
        this.currentGames[socket.roomCode]  = b
        b.inProgress                        = true
        b.responses                         = {}
        b.expectedResponseCount             = this.numberInRoom(socket.roomCode)
        b.duration                          = process.env.GAME_LENGTH

        var startResponse       = new clientResponse()
        startResponse.event     = "gameStart"
        startResponse.data      = b
        await this.sendToWholeRoom(socket.roomCode, startResponse)

        // Capture roomCode now — socket.roomCode may be null by the time the timer fires
        var roomCode = socket.roomCode
        setTimeout(() => {
            b.inProgress = false
            var endResponse     = new clientResponse()
            endResponse.event   = "gameEnd"
            endResponse.data    = "Clock ran out"
            this.sendToWholeRoom(roomCode, endResponse)
        }, process.env.GAME_LENGTH * 1000)
    }

    async handleFoundWords(socket, parsedData, messageResponse) {
        if (!parsedData || !this.validateFoundWords(parsedData)) {
            createErrorMessage(messageResponse, parsedData ? this.validateFoundWords.errors : "This message type requires data")
            socket.send(JSON.stringify(messageResponse))
            return
        }

        var roomBoard = this.currentGames[socket.roomCode]
        if (!roomBoard) {
            createErrorMessage(messageResponse, "No active game found for this room")
            socket.send(JSON.stringify(messageResponse))
            return
        }
        if (roomBoard.inProgress) {
            createErrorMessage(messageResponse, "Game still in progress")
            socket.send(JSON.stringify(messageResponse))
            return
        }

        roomBoard.responses[socket.id]          = {}
        roomBoard.responses[socket.id].words    = parsedData.words.sort().map(w => w.toUpperCase())
        roomBoard.responses[socket.id].name     = socket.name

        if (Object.keys(roomBoard.responses).length >= roomBoard.expectedResponseCount) {
            this.resolveGame(roomBoard, socket.roomCode)
        }
    }

    async handleBoardHistoryCount(socket) {
        if (!socket.roomCode) {
            socket.roomCode = HOME_PAGE_ROOM
        }
        socket.send(JSON.stringify(await this.getFreshHistory()))
    }

    async handleBrowserPlaySoloBoard(socket) {
        var b = new Board()
        b.fillSquares()
        await b.solveBoard()
        var response    = new clientResponse()
        response.event  = "soloBoard"
        response.data   = b
        socket.send(JSON.stringify(response))
    }

    async handleDefinition(socket, parsedData) {
        if (!parsedData || !parsedData.word) {
            var errorResponse = new clientResponse()
            createErrorMessage(errorResponse, "This message type requires data with a 'word' field")
            socket.send(JSON.stringify(errorResponse))
            return
        }
        var definition  = await definitionAPI.getWordDefinition(parsedData.word)
        var response    = new clientResponse()
        response.event  = "definition"
        response.data   = definition
        socket.send(JSON.stringify(response))
    }

    // Adjusts game state when a player leaves or disconnects mid-game or post-game.
    // Must be called AFTER removing the socket from this.connections (for handleClose)
    // or AFTER clearing socket.roomCode (for handleLeaveRoom).
    handleDepartingSocket(socket, roomCode) {
        const game = this.currentGames[roomCode]
        if (!game) return

        if (game.inProgress) {
            // Reduce headcount so the game timer resolves correctly
            game.expectedResponseCount--
        } else if (!game.responses[socket.id]) {
            // Game ended but this player never submitted their words
            game.expectedResponseCount--
            if (game.expectedResponseCount > 0 && Object.keys(game.responses).length >= game.expectedResponseCount) {
                this.resolveGame(game, roomCode)
            }
        }
    }

    resolveGame(roomBoard, roomCode) {
        console.log("All responses received for room " + roomCode)
        this.scoreResults(roomBoard)
        var response    = new clientResponse()
        response.event  = "gameResults"
        response.data   = {
            winners:        roomBoard.winners,
            unfoundWords:   roomBoard.unfoundWords,
            responses:      roomBoard.responses
        }
        this.sendToWholeRoom(roomCode, response)
    }

    async getFreshHistory() {
        var response    = new clientResponse()
        response.event  = "boardHistoryCount"
        response.data   = { history: await config.getBoardHistory() }
        return response
    }

    async updateHomePage() {
        var hasHomePageConnections = this.connections.some(c => c.roomCode === HOME_PAGE_ROOM)
        if (hasHomePageConnections) {
            await this.sendToWholeRoom(HOME_PAGE_ROOM, await this.getFreshHistory())
        }
    }

    async sendToWholeRoom(roomCode, message) {
        return new Promise((resolve) => {
            var targets = this.connections.filter(c => c.roomCode === roomCode)
            if (targets.length === 0) {
                resolve()
                return
            }
            var sent = 0
            for (const connection of targets) {
                connection.send(JSON.stringify(message), () => {
                    if (++sent === targets.length) resolve()
                })
            }
        })
    }

    scoreResults(board) {
        var highestScore    = 0
        board.unfoundWords  = board.words.map(w => w.toUpperCase())

        for (var key in board.responses) {
            var response            = board.responses[key]
            var currentScore        = 0
            response.uniqueWords    = []

            var otherWords = new Set()
            for (var key2 in board.responses) {
                if (key2 === key) continue
                for (var word of board.responses[key2].words) otherWords.add(word)
            }

            for (var word of response.words) {
                if (!otherWords.has(word)) {
                    response.uniqueWords.push(word)
                    switch (word.length) {
                        case 3:
                        case 4: currentScore += 1;  break
                        case 5: currentScore += 2;  break
                        case 6: currentScore += 3;  break
                        case 7: currentScore += 5;  break
                        default: currentScore += 11; break
                    }
                }
            }
            if (currentScore > highestScore) highestScore = currentScore
            response.score = currentScore
        }

        board.winners = []
        for (var key in board.responses) {
            var response = board.responses[key]
            if (response.score === highestScore) board.winners.push(key)
            for (var word of response.words) {
                var idx = board.unfoundWords.indexOf(word)
                if (idx !== -1) board.unfoundWords.splice(idx, 1)
            }
        }
    }

    numberInRoom(roomCode) {
        return this.connections.filter(c => c.roomCode === roomCode).length
    }
}

function createErrorMessage(message, data) {
    message.status  = "error"
    message.event   = "error"
    message.data    = data
}
