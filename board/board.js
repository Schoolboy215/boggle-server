const cubes = [
    ['A','A','E','E','G','N'],
    ['A','B','B','J','O','O'],
    ['A','C','H','O','P','S'],
    ['A','F','F','K','P','S'],
    ['A','O','O','T','T','W'],
    ['C','I','M','O','T','U'],
    ['D','E','I','L','R','X'],
    ['D','E','L','R','V','Y'],
    ['D','I','S','T','T','Y'],
    ['E','E','G','H','N','W'],
    ['E','E','I','N','S','U'],
    ['E','H','R','T','V','W'],
    ['E','I','O','S','S','T'],
    ['E','L','R','T','T','Y'],
    ['H','I','M','N','U','Qu'],
    ['H','L','N','N','R','Z']
]

var config = require("../config")
var stack = []

function findNeighbors(spot){
    var neighbors = new Array()
    if (spot%4){
        neighbors.push(spot-1)     //LEFT
        if (spot>3)
            neighbors.push(spot-5) //ABOVE LEFT
        if (spot<12)
            neighbors.push(spot+3) //BELOW LEFT
    }
    if (spot>3)
        neighbors.push(spot-4)     //ABOVE CENTER
    if (spot==0 || (spot+1) % 4) {
        neighbors.push(spot+1)     //RIGHT
        if (spot>3)
            neighbors.push(spot-3) //ABOVE RIGHT
        if (spot<12)
            neighbors.push(spot+5) //BELOW RIGHT
    }
    if (spot < 12)
        neighbors.push(spot+4)     //BELOW CENTER
    neighbors = neighbors.sort()
    return neighbors
}
module.exports = class Board {
    constructor() {
        this.squares    = []
        this.words      = []
    }

    fillSquares() {
        var used = new Array(16)
        var filled = 0
        while (filled < 16) {
            var spot = Math.floor(Math.random() * 16)
            while (used[spot])
                spot = Math.floor(Math.random() * 16)
            this.squares[filled] = cubes[spot][Math.floor(Math.random() * 6)]
            used[spot] = true
            filled++
        }
    }

    async solveBoard() {
        return new Promise( async (resolve,reject) => {
            for (var y = 0; y < 4; y++)
            {
                for (var x = 0; x < 4; x++)
                {
                    var spot = y*4 + x
                    await this.solveSpot(spot, [], this.squares[spot])
                }
            }
            this.words = this.words.sort()
            config.diskDB.run("INSERT INTO boardHistory(timestamp) VALUES(CURRENT_TIMESTAMP)", err => {
                resolve()
            })
        })
    }

    solveSpot(_spot, _used, _soFar) {
        var spot    = _spot
        var used    = [..._used]
        var soFar   = _soFar

        used.push(spot)
        return new Promise( async (resolve,reject) => {
            var neighbors = findNeighbors(spot)
            for (var i = 0; i < neighbors.length; i++)
            {
                var s = neighbors[i]
                if (!used.includes(s))
                {
                    var building = (soFar + this.squares[s]).toLowerCase()
                    var words = await this.checkWord(building)
                    if (words.length)
                    {
                        if (words.includes(building) && !this.words.includes(building))
                        {
                            this.words.push(building)
                        }
                        await this.solveSpot(s, used, building)
                    }
                }
            }
            resolve()
        })
    }

    async checkWord(word) {
        return new Promise(async (resolve,reject) => {
            resolve(await config.findWord(word))
        })
    }

    boardToJSON() {
        return JSON.stringify(this.squares)
    }
}