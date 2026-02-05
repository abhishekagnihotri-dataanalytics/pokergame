// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // Serve frontend files

// ===== Poker Game Logic =====
class PokerGame {
    constructor() {
        this.players = [];
        this.bots = [];
        this.deck = [];
        this.pot = 0;
        this.currentBet = 0;
        this.communityCards = [];
    }

    addPlayer(player) {
        this.players.push(player);
    }

    addBot(name) {
        this.bots.push({ name, hand: [] });
    }

    resetDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        this.deck = [];
        for (let suit of suits) {
            for (let value of values) {
                this.deck.push({ suit, value });
            }
        }
        this.shuffleDeck();
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    dealCards() {
        for (let player of this.players) {
            player.hand = [this.deck.pop(), this.deck.pop()];
        }
        for (let bot of this.bots) {
            bot.hand = [this.deck.pop(), this.deck.pop()];
        }
    }
}

const game = new PokerGame();

// ===== WebSocket Connections =====
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinGame', (playerName) => {
        const player = { id: socket.id, name: playerName, hand: [], chips: 1000 };
        game.addPlayer(player);
        io.emit('updatePlayers', game.players.map(p => ({ name: p.name, chips: p.chips })));
    });

    socket.on('addBot', (botName) => {
        game.addBot(botName);
        io.emit('updatePlayers', [...game.players.map(p => ({ name: p.name, chips: p.chips })), ...game.bots.map(b => ({ name: b.name }))]);
    });

    socket.on('startGame', () => {
        game.resetDeck();
        game.dealCards();
        io.emit('dealHands', game.players.map(p => ({ id: p.id, hand: p.hand })));
        io.emit('communityCards', game.communityCards);
    });

    socket.on('disconnect', () => {
        game.players = game.players.filter(p => p.id !== socket.id);
        io.emit('updatePlayers', game.players.map(p => ({ name: p.name, chips: p.chips })));
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
