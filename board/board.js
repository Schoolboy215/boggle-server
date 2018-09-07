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
module.exports = class Board {
    constructor() {
        this.squares = [];
    }

    fillSquares() {
        var used = new Array(16);
        var filled = 0;
        while (filled < 16) {
            var spot = Math.floor(Math.random() * 16);
            while (used[spot])
                spot = Math.floor(Math.random() * 16);
            this.squares[filled] = cubes[spot][Math.floor(Math.random() * 6)]
            used[spot] = true;
            filled++;
        }
    }

    boardToJSON() {
        return JSON.stringify(this.squares);
    }
}