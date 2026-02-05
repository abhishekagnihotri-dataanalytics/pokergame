// pokerEvaluator.js
const RANKS={'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};

function getHandRank(cards){
    const values = cards.map(c=>RANKS[c.value]).sort((a,b)=>b-a);
    const suits = cards.map(c=>c.suit);
    const valueCounts = {};
    values.forEach(v=>valueCounts[v]=(valueCounts[v]||0)+1);
    const counts = Object.values(valueCounts).sort((a,b)=>b-a);
    const uniqueValues = Object.keys(valueCounts).map(Number).sort((a,b)=>b-a);
    const isFlush = suits.every(s=>s===suits[0]);
    const isStraight = uniqueValues.length>=5 && uniqueValues[0]-uniqueValues[4]===4;
    const hand={rank:0,tiebreaker:values};
    if(isStraight && isFlush && uniqueValues[0]===14) hand.rank=10;
    else if(isStraight && isFlush) hand.rank=9;
    else if(counts[0]===4) hand.rank=8;
    else if(counts[0]===3 && counts[1]===2) hand.rank=7;
    else if(isFlush) hand.rank=6;
    else if(isStraight) hand.rank=5;
    else if(counts[0]===3) hand.rank=4;
    else if(counts[0]===2 && counts[1]===2) hand.rank=3;
    else if(counts[0]===2) hand.rank=2;
    else hand.rank=1;
    return hand;
}

function compareHands(a,b){
    if(a.rank>b.rank) return 1;
    if(a.rank<b.rank) return -1;
    for(let i=0;i<a.tiebreaker.length;i++){
        if(a.tiebreaker[i]>b.tiebreaker[i]) return 1;
        if(a.tiebreaker[i]<b.tiebreaker[i]) return -1;
    }
    return 0;
}

module.exports={getHandRank,compareHands};
