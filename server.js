// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { getHandRank, compareHands } = require('./pokerEvaluator');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// ===== Poker Game Class =====
class PokerGame {
    constructor() {
        this.players = []; // humans
        this.bots = [];    // bots
        this.deck = [];
        this.pot = 0;
        this.currentBet = 0;
        this.communityCards = [];
        this.round = 'pre-flop';
        this.currentTurn = 0;
    }

    resetDeck() {
        const suits = ['♠','♥','♦','♣'];
        const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        this.deck = [];
        for(const s of suits){
            for(const v of values){
                this.deck.push({suit:s, value:v});
            }
        }
        this.shuffleDeck();
    }

    shuffleDeck(){
        for(let i=this.deck.length-1;i>0;i--){
            const j = Math.floor(Math.random()*(i+1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    dealHands(){
        for(const p of this.players) p.hand = [this.deck.pop(), this.deck.pop()], p.folded=false;
        for(const b of this.bots) b.hand = [this.deck.pop(), this.deck.pop()], b.folded=false;
    }

    dealCommunity(num){
        for(let i=0;i<num;i++) this.communityCards.push(this.deck.pop());
    }

    getActivePlayers(){
        return [...this.players, ...this.bots].filter(p=>!p.folded && p.chips>0);
    }

    nextTurn(){
        const active = this.getActivePlayers();
        if(active.length<=1) return this.endRound();
        this.currentTurn = (this.currentTurn+1)%active.length;
        return active[this.currentTurn];
    }

    endRound(){
        const winner = this.evaluateWinner();
        if(winner) winner.chips += this.pot;
        const winnerName = winner ? winner.name : "No one";
        const pot = this.pot;
        this.resetGame();
        return { winnerName, pot };
    }

    resetGame(){
        this.pot=0;
        this.currentBet=0;
        this.communityCards=[];
        this.round='pre-flop';
        this.currentTurn=0;
        for(const p of this.players) p.currentBet=0, p.folded=false;
        for(const b of this.bots) b.currentBet=0, b.folded=false;
    }

    evaluateWinner(){
        const active = this.getActivePlayers();
        if(active.length===1) return active[0];
        let bestPlayer = null;
        let bestRank = null;
        for(const p of active){
            const combined = [...p.hand, ...this.communityCards];
            const rank = getHandRank(combined);
            if(!bestRank || compareHands(rank, bestRank)>0){
                bestRank = rank;
                bestPlayer = p;
            }
        }
        return bestPlayer;
    }
}

const game = new PokerGame();

// ===== Socket.io =====
io.on('connection', socket=>{
    console.log('User connected:', socket.id);

    socket.on('joinGame', playerName=>{
        const player = {id:socket.id, name:playerName, hand:[], chips:1000, folded:false, currentBet:0};
        game.players.push(player);
        io.emit('updatePlayers', [...game.players,...game.bots].map(p=>({name:p.name, chips:p.chips})));
    });

    socket.on('addBot', botName=>{
        const bot = {name:botName, hand:[], chips:1000, folded:false, currentBet:0};
        game.bots.push(bot);
        io.emit('updatePlayers', [...game.players,...game.bots].map(p=>({name:p.name, chips:p.chips})));
    });

    socket.on('startGame', ()=>{
        game.resetGame();
        game.resetDeck();
        game.dealHands();
        io.emit('dealHands',[...game.players.map(p=>({id:p.id, hand:p.hand})),...game.bots.map(b=>({name:b.name, hand:b.hand}))]);
        io.emit('communityCards', game.communityCards);
        io.emit('yourTurn', game.getActivePlayers()[game.currentTurn].id===socket.id);
    });

    socket.on('playerAction', ({action, amount})=>{
        const player = game.players.find(p=>p.id===socket.id);
        if(!player||player.folded) return;

        if(action==='fold') player.folded=true;
        if(action==='call'){
            const toCall = game.currentBet - player.currentBet;
            player.chips -= toCall;
            player.currentBet += toCall;
            game.pot += toCall;
        }
        if(action==='raise'){
            amount = Math.min(amount, player.chips);
            player.chips -= amount;
            player.currentBet += amount;
            game.currentBet = player.currentBet;
            game.pot += amount;
        }

        // Bot AI
        for(const bot of game.bots){
            if(!bot.folded && bot.chips>0){
                const combined = [...bot.hand, ...game.communityCards];
                const rank = getHandRank(combined).rank;
                const rand = Math.random();
                if(rank<=2){ if(rand<0.7) bot.folded=true; else bot.chips-=game.currentBet; }
                else if(rank<=5){ if(rand<0.5) bot.chips-=game.currentBet; else bot.chips-=Math.min(bot.chips,game.currentBet+50); }
                else{ if(rand<0.8) bot.chips-=Math.min(bot.chips,game.currentBet+100); else bot.chips-=game.currentBet; }
            }
        }

        const nextPlayer = game.nextTurn();
        io.emit('updatePlayers',[...game.players,...game.bots].map(p=>({name:p.name,chips:p.chips})));
        io.emit('communityCards',game.communityCards);

        const active = game.getActivePlayers();
        if(active.length<=1){
            const result = game.endRound();
            io.emit('roundEnded', result);
        } else {
            io.emit('yourTurn', nextPlayer.id===socket.id);
        }
    });

    socket.on('disconnect', ()=>{
        game.players = game.players.filter(p=>p.id!==socket.id);
        io.emit('updatePlayers',[...game.players,...game.bots].map(p=>({name:p.name,chips:p.chips})));
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT||3000;
server.listen(PORT, ()=>console.log('Server running on port',PORT));
