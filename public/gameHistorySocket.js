webSocket = null
// Allow for TLS and non-TLS websockets
if (location.protocol == 'https:')
{
    webSocket = new WebSocket('wss://'+location.host)
}
else if (location.protocol == 'http:')
{
    webSocket = new WebSocket('ws://'+location.host)
}
numberHolder    = document.getElementById('gameCounter')
timeSinceHolder = document.getElementById('timeSinceLast')

webSocket.onopen = function()
{
    console.log("Connected to websocket for stat updates")
    webSocket.send('{"event":"boardHistoryCount","status":"ok"}')
}

webSocket.onmessage = function(event)
{
    try
    {
        var parsedJSON              = JSON.parse(event.data)

        numberHolder.innerHTML      = parsedJSON["data"]["history"][0]
        if (parsedJSON["data"]["history"][1] != 0)
        {
            timeSinceHolder.innerHTML   = new Date(parsedJSON["data"]["history"][1] + " GMT").toLocaleString()
        }
        else
        {
            timeSinceHolder.innerHTML   = '-'
        }
    }
    catch{
        // Invalid JSON received
    }
}