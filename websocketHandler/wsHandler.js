var crypto = require("crypto");
const { connect } = require("http2");
const { join, parse } = require("path");
var Board = require('../board/board');
var Ajv = require('ajv');
require('dotenv').config();
var config = require("../config");

var connections=[]
var currentGames = {}
var apiToken = "";
var ajv = new Ajv({"allErrors":"true"});
var schema = require('./wsSchema.json');

class clientResponse {
    constructor() {
        this.status = "";
        this.event = "";
        this.data = "";
    }
}

module.exports = class wsHandler {
    constructor() {
        this.connections = [];
        this.currentGames = {};
        this.validate = ajv.compile(schema);
        this.apiToken = config.getAPIToken();
    }

    handleConnection(socket) {
        socket.send("Connection accepted. You are client " + this.connections.length);
        socket.id = crypto.randomBytes(8).toString('hex');
        this.connections.push(socket);

        socket.on('close', (reasonCode, description) => {
            this.handleClose(socket);
        });
        socket.on('message', (message) => {
            this.handleMessage(socket, message);
        });
    }

    handleClose(socket) {
        var index = this.connections.indexOf(socket);
        this.connections.splice(index,1);
    }

    async handleMessage(socket, message) {
        var messageResponse = new clientResponse();
        messageResponse.status = "ok";

        try
        {
            var parsedMessage = JSON.parse(message);
            var parsedData = null;
            if (parsedMessage['data'])
            {
                if (typeof parsedMessage['data'] === 'object')
                    parsedData = parsedMessage['data'];
            }
            var validJSON = this.validate(parsedMessage);
            if (!validJSON)
            {
                createErrorMessage(messageResponse, this.validate.errors);
                socket.send(JSON.stringify(messageResponse));
                return;
            }
            var messageType = parsedMessage['event'];
            if (this.apiToken)
            {
                if (parsedMessage['apiToken'])
                {
                    if (parsedMessage['apiToken'] != this.apiToken)
                    {
                        throw new Error("Incorrect apiToken");
                    }
                }
                else
                {
                    throw new Error("Missing apiToken");
                }
            }
        }
        catch(err)
        {
            createErrorMessage(messageResponse, err.message);
            socket.send(JSON.stringify(messageResponse));
            return;
        }

        try
        {
            switch (messageType)
            {
                case 'createRoom':
                    if (socket.roomCode)
                    {
                        createErrorMessage(messageResponse, "Connection already has room code");
                    }
                    else
                    {
                        socket.roomCode = crypto.randomBytes(parseInt(process.env.ROOMCODE_BYTES)).toString('hex');
                        socket.name = parsedData['name'];
                        messageResponse.event = "roomCode";
                        messageResponse.data = socket.roomCode;
                    }
                    socket.send(JSON.stringify(messageResponse));
                    break;
                case 'joinRoom':
                    if (socket.roomCode)
                    {
                        createErrorMessage(messageResponse, "Connection already in a room");
                    }
                    else
                    {
                        try{
                            var roomToJoin = parsedData['roomCode'];
                            socket.name = parsedData['name'];
                        }
                        catch(err)
                        {
                            createErrorMessage(messageResponse, err.message);
                            socket.send(JSON.stringify(messageResponse));
                            return;
                        }
                        for (const connection of this.connections)
                        {
                            if (connection.roomCode && connection.roomCode == roomToJoin && connection != socket)
                            {
                                socket.roomCode = roomToJoin;
                                var joinResponse = new clientResponse();
                                joinResponse.event = "joinNotification";
                                joinResponse.data = socket.name + " joined your room";
                                connection.send(JSON.stringify(joinResponse));
                            }
                        }
                        if (socket.roomCode)    //A connection with the matching code was found
                        {
                            messageResponse.event = "joinSuccess";
                        }
                        else                    //No match found. Send error
                        {
                            createErrorMessage(messageResponse, "Room code not found");
                        }
                        
                    }
                    socket.send(JSON.stringify(messageResponse));
                    break;
                case 'startGame':
                    if (!socket.roomCode)
                    {
                        createErrorMessage(messageResponse, "Connection is not in a room");
                        socket.send(JSON.stringify(messageResponse));
                        break;
                    }
                    if (this.currentGames[socket.roomCode])
                    {
                        var roomBoard = this.currentGames[socket.roomCode];
                        if (roomBoard.inProgress)
                        {
                            createErrorMessage(messageResponse, "Game still in progress");
                            socket.send(JSON.stringify(messageResponse));
                            break;
                        }
                    }
                    var b = new Board();
                    b.fillSquares();
                    await b.solveBoard();
                    this.currentGames[socket.roomCode] = b;
                    b.inProgress = true;
                    b.responses = {};
                    b.expectedResponseCount = this.numberInRoom(socket.roomCode);
                    var startResponse = new clientResponse();
                    startResponse.event = "gameStart";
                    startResponse.data = b;
                    await this.sendToWholeRoom(socket.roomCode, startResponse); //This sends the new board to all sockets in the room and lets them know it's time to start playing
                    var endResponse = new clientResponse();
                    endResponse.event = "gameEnd";
                    endResponse.data = "Clock ran out";
                    setTimeout(() => {
                        b.inProgress = false;
                        this.sendToWholeRoom(socket.roomCode, endResponse);
                    }, process.env.GAME_LENGTH*1000);
                    break;
                case 'foundWords':
                    var roomBoard = this.currentGames[socket.roomCode];
                    if (roomBoard.inProgress)
                    {
                        createErrorMessage(messageResponse, "Game still in progress");
                        socket.send(JSON.stringify(messageResponse));
                        break;
                    }
                    roomBoard.responses[socket.id] = {};
                    roomBoard.responses[socket.id].words = parsedData['words'];
                    roomBoard.responses[socket.id].name = socket.name;
                    if (Object.keys(roomBoard.responses).length == roomBoard.expectedResponseCount)
                    {
                        console.log("ALL RESPONSES RECEIVED FOR ROOM " + socket.roomCode);
                        this.scoreResults(roomBoard);
                        messageResponse.event = "gameResults";
                        messageResponse.data = {};
                        messageResponse.data["winners"] = roomBoard.winners;
                        messageResponse.data["responses"] = roomBoard.responses;
                        this.sendToWholeRoom(socket.roomCode, messageResponse);
                    }
                    break;
                default:
                    createErrorMessage(messageResponse, "Message type not recognized");
                    socket.send(JSON.stringify(messageResponse));
                    break;
            }
        }
        catch(err)
        {
            console.log("Error during message process : " + err)
        }
    }

    sendToWholeRoom(roomCode, message) {
        return new Promise( async (resolve, reject) => {
            var receiptTarget = 0;
            var sent = 0;
            for (const connection of this.connections)
            {
                if (connection.roomCode && connection.roomCode == roomCode)
                {
                    receiptTarget += 1;
                }
            }
            for (const connection of this.connections)
            {
                if (connection.roomCode && connection.roomCode == roomCode)
                {
                    connection.send(JSON.stringify(message), () => {
                        sent += 1;
                        if (sent == receiptTarget)
                        {
                            resolve("All sent");
                        }
                    });
                }
            }
        });
    }

    scoreResults(board)
    {
        var highestScore = 0;
        for (var key in board.responses)
        {
            var response = board.responses[key];
            var currentScore = 0;
            response.uniqueWords = [];

            var otherWords = new Set();
            for (var key2 in board.responses)
            {
                if (key2 == key)
                {
                    continue;
                }
                for (var wordIndex in board.responses[key2].words)
                {
                    otherWords.add(board.responses[key2].words[wordIndex]);
                }
            }

            for (var wordIndex in response.words)
            {
                if (!otherWords.has(response.words[wordIndex]))
                {
                    response.uniqueWords.push(response.words[wordIndex]);
                    switch(response.words[wordIndex].length)
                    {
                        case 3:
                        case 4:
                            currentScore += 1;
                            break;
                        case 5:
                            currentScore += 2;
                            break;
                        case 6:
                            currentScore += 3;
                            break;
                        case 6:
                            currentScore += 5;
                            break;
                        default:
                            currentScore += 11;
                            break;
                    }
                }
            }
            if (currentScore > highestScore)
            {
                highestScore = currentScore;
            }
            response.score = currentScore;
        }
        board.winners = [];
        for (var key in board.responses)
        {
            var response = board.responses[key];
            if (response.score == highestScore)
            {
                board.winners.push(key);
            }
        }
    }

    numberInRoom(roomCode)
    {
        var toReturn = 0;
        for (const connection of this.connections)
        {
            if (connection.roomCode && connection.roomCode == roomCode)
            {
                toReturn += 1;
            }
        }
        return toReturn;
    }
}

function hasJsonStructure(str) {
    if (typeof str !== 'string') return false;
    try {
        const result = JSON.parse(str);
        const type = Object.prototype.toString.call(result);
        return type === '[object Object]' 
            || type === '[object Array]';
    } catch (err) {
        return false;
    }
}

function createErrorMessage(message, data)
{
    message.status = "error";
    message.event = "error";
    message.data = data;
}