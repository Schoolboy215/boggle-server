webSocket = null
validWords = []
foundWords = []
var timer;
var timeRemaining;

// Allow for TLS and non-TLS websockets
if (location.protocol == 'https:')
{
    webSocket = new WebSocket('wss://'+location.host)
}
else if (location.protocol == 'http:')
{
    webSocket = new WebSocket('ws://'+location.host)
}

webSocket.onopen = function()
{
    console.log("Connected to websocket for in-browser play")
    $(function() {
        $('#generateSoloBtn').attr("disabled", false)
    })
}

webSocket.onmessage = function(event)
{
    try
    {
        var parsedJSON              = JSON.parse(event.data)

        switch(parsedJSON["event"])
        {
            // We got a response back to our solo request. Kick off a new game
            case "soloBoard":
                validWords = parsedJSON.data["words"]
                startSoloGame(parsedJSON.data["squares"])
                break
            case "error":
                console.error(`WS error response: ${parsedJSON["data"]}`)
                alert(`WS error response: ${parsedJSON["data"]}`)
                break
            case "definition":
                $('#definitionToast').children('.toast-body').text(`${parsedJSON["data"].definition}`)
                var definitionToastExample = document.getElementById('definitionToast')
                var toast = new bootstrap.Toast(definitionToastExample)
                toast.show()
                break
            default:
                console.error("Unrecognized WS response from server")
                break
        }
    }
    catch(ex){
        // Invalid JSON received
    }
}

// Document is loaded. Set up our event handlers
$(function(){

    document.getElementById("generateSoloBtn").onclick = generateSoloBoard
    document.getElementById("submitWord").onclick = submitWord
    document.getElementById("clearWord").onclick = clearWord

    document.querySelector("#wordField").addEventListener("keyup", event => {
        if(event.key !== "Enter") return; // Use `.key` instead.
        submitWord()
        event.preventDefault(); // No need to `return false;`.
    });
})

// Function called when we click the generate button
// Simply sends the WS request
function generateSoloBoard()
{
    webSocket.send(`{"event":"browserPlay_soloBoard","status":"ok","apiToken":"${$('#apiToken').val()}"}`)
}

// Called from startSoloGame()
// Just makes our grid of buttons with letters and sets up their on click events
function fillBoard(squares)
{
    var board = $("#board")
    board.empty()
    for (var row = 0; row < 4; row++)
    {
        $newRow = $('<div>', {class : 'btn-group btn-group-lg'})
        for (var column = 0; column < 4; column++)
        {
            $newButton = $('<button>', {class: "btn btn-secondary btn-sq", type: "button"})
            $newButton.text(squares[column + row*4])
            $newButton.attr('onClick','squarePressed(this)')
            $newRow.append($newButton)
        }
        board.append($newRow)
    }
}
// Called when we get our WS response back from the server
// Fills the board and makes sure the right elements are visible
// Also clears the stage from the last run
function startSoloGame(squares)
{
    fillBoard(squares)

    $('#clockHolder').show()
    $('#boardHolder').show()
    $('#playerLists').empty()
    $('#playingList').text("")
    $('#resultsHolder').show()
    $('#apiTokenInput').hide()

    // We need to un-disable the board if another round previously locked it
    $('#boardHolder *').attr('disabled', false)
    // Clear out the list of found words in case we already played one
    foundWords.length = 0

    timeRemaining = 180
    $('#clock').text(`${Math.floor(timeRemaining/60) > 0 ? Math.floor(timeRemaining/60).toString() : "0"}:${(timeRemaining % 60).toString().padStart(2,"0")}`)
    timer = window.setInterval(timerTick, 1000)

    $('#wordField').focus()

}
// Called after the timer runs out
// Locks the board from further input, reveals the winner, and puts result cards at the bottom of the screen
function endSoloGame()
{
    $('#boardHolder *').attr('disabled', "disabled")
    $('#clockHolder').hide()
    $('#apiTokenInput').show()

    var allAIWords          = []
    var uniqueAIWords       = []
    var uniquePlayerWords   = []
    var unfoundWords        = []

    for (const word of validWords)
    {
        if (Math.random() < 0.3)
        {
            allAIWords.push(word)
            uniqueAIWords.push(word)
        }
        else
        {
            unfoundWords.push(word)
        }
    }

    for (const word of foundWords)
    {
        if (!allAIWords.includes(word))
        {
            uniquePlayerWords.push(word)
        }
        else
        {
            uniqueAIWords.splice(uniqueAIWords.indexOf(word),1)
        }
        if (unfoundWords.includes(word))
        {
            unfoundWords.splice(unfoundWords.indexOf(word),1)
        }
    }
    const playerScore = scoreList(uniquePlayerWords)
    const AIScore = scoreList(uniqueAIWords)
    if (AIScore > playerScore)
    {
        $('#playingList').text(`The AI won (${AIScore} - ${playerScore})`)
    }
    else if (playerScore > AIScore)
    {
        $('#playingList').text(`You won! (${playerScore} - ${AIScore})`)
    }
    else
    {
        $('#playingList').text(`You tied. (${playerScore} points)`)
    }

    addWordBlock('You', foundWords, uniquePlayerWords)
    addWordBlock('AI', allAIWords, uniqueAIWords)
    addWordBlock('Unfound', unfoundWords, null)

}
// Simply tallies up the score according to normal Boggle rules given an input array
function scoreList(words)
{
    var score = 0
    for (const word of words)
    {
        switch (word.length)
        {
            case 3:
            case 4:
                score += 1
                break
            case 5:
                score += 2
                break
            case 6:
                score += 3
                break
            case 7:
                score += 5
                break
            default:
                score += 6
        }
    }
    return score
}
// Called once per second
// Decrements timer and sets the clock text
// Calls the end game logic after timer reaches 0
function timerTick()
{
    timeRemaining -= 1;
    $('#clock').text(`${Math.floor(timeRemaining/60) > 0 ? Math.floor(timeRemaining/60).toString() : "0"}:${(timeRemaining % 60).toString().padStart(2,"0")}`)
    if (timeRemaining <= 0)
    {
        clearTimeout(timer)
        endSoloGame()
    }
}

// Called if any letter square is pressed
// Adds the letter's text to the word box
function squarePressed($sender)
{
    $('#wordField').val($('#wordField').val() + $sender.textContent.toLowerCase())
}

// Check if the word currently typed is valid
// Adds it to the list if yes
function submitWord()
{
    $('#wordField').val($('#wordField').val().toLowerCase())
    var word = $('#wordField').val()
    if (validWords.includes(word))
    {
        if (!foundWords.includes(word))
        {
            foundWords.push(word)
            foundWords.sort()
            $('#playingList').text("")
            $('#playingList').text(foundWords.join(', '))
        }
        $('#wordField').val("")
    }
}
// Clear the word typed. Useful if on a phone
function clearWord()
{
    $('#wordField').val("")
}

// Function to add a bootstrap card to the bottom with a summary for the player (or AI)
function addWordBlock(name, allWords, uniqueWords)
{
    $playerLists = $('#playerLists')

    $newCard = $('<div>', {class: "card bg-light mb-3"})
    $newCardHeader = $('<div>', {class: "card-header h3"})
    $newCardHeader.text(`${name} (${allWords.length} words)`)
    $newCard.append($newCardHeader)
    $newCardTable = $('<table>', {class: "table card-table table-hover"})
    $newCardTableBody = $('<tbody>')
    for (const word of allWords)
    {
        $newCardRow = $('<tr>')
        $newCardField = $('<td>')
        $newCardText = $('<p>', {class: "h4"})
        if (uniqueWords != null && !uniqueWords.includes(word))
        {
            $strikeThroughText = $('<s>')
            $strikeThroughText.text(word)
            $newCardText.append($strikeThroughText)
        }
        else
        {
            $newCardText.text(word)
        }
        $newCardField.append($newCardText)
        $newCardRow.attr('onClick',`lookupDefinition(this)`)
        $newCardRow.append($newCardField)
        $newCardTableBody.append($newCardRow)
    }
    $newCardTable.append($newCardTableBody)
    $newCard.append($newCardTable)

    $playerLists.append($newCard)
}
function lookupDefinition($sender)
{
    webSocket.send(`{"event":"definition","status":"ok","apiToken":"${$('#apiToken').val()}","data":{"word":"${$sender.textContent.toLowerCase()}"}}`)
}