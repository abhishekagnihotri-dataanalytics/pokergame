const mongoose=require('mongoose');
mongoose.connect('mongodb://localhost/poker',{useNewUrlParser:true,useUnifiedTopology:true});
const playerSchema=new mongoose.Schema({username:String,passwordHash:String,chips:{type:Number,default:1000}});
const Player=mongoose.model('Player',playerSchema);
module.exports=Player;
