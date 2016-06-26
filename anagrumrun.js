var io;
var gameSocket;
var cont = [];
var contador = 0;
var valTotal = 0;
var tempos = [];
//Esta função é chamada pela index.js para iniciar um novo jogo

exports.initGame = function(sio,socket)
{
    
    io = sio;
    gameSocket = socket;
    gameSocket.emit('connected',{message:"Você está conectado!"});
    
    
    
    // Eventos de host
    gameSocket.on('hostCreateNewGame', hostCreateNewGame);
    gameSocket.on('hostRoomFull', hostPrepareGame);
    gameSocket.on('hostCountdownFinished', hostStartGame);
    gameSocket.on('hostNextRound', hostNextRound);

    // Eventos de jogador
    gameSocket.on('playerJoinGame', playerJoinGame);
    gameSocket.on('playerAnswer', playerAnswer);
    gameSocket.on('playerRestart', playerRestart);
}

function getTime(time)
{
    time = time - 2000;
    console.log(cont.push(time));
    
    if(cont.length > 2)
    {
        var val  = cont[contador] - cont[contador-1];    
            
        if(val != NaN)
        {
            tempos.push(val);
            valTotal = valTotal + val;
            console.log(valTotal);
        }
    
    var fs = require('fs');
    var wstream = fs.createWriteStream('myOutput.txt');
    wstream.write(tempos.toString());
    wstream.end();
    
    var media = valTotal/tempos.length;
    console.log(media);
    
    wstream = fs.createWriteStream('media.txt');
    wstream.write(media.toString());
    wstream.end();
    }
    contador ++;
    
};

/* *******************************
   *                             *
   *       Funções de host       *
   *                             *
   ******************************* */
   
   // O botão 'START' foi clicado e 'hostCreateNewGame' ocorre.
   
   function hostCreateNewGame() {
    
    getTime(new Date().getTime());
    // Cria um jogo Socket.IO único
    var thisGameId = ( Math.random() * 100000 ) | 0;

    // Reotna o ID do jogo (gameId) e o ID da conexão do Socket.IO para o cliente
    this.emit('newGameCreated', {gameId: thisGameId, mySocketId: this.id});

    // Entra no jogo e aguarda outros jogadores
    this.join(thisGameId.toString());
};

//Quando dois jogadores tiverem entrado alerte o host.

function hostPrepareGame(gameId) {
    var sock = this;
    var data = {
        mySocketId : sock.id,
        gameId : gameId
    };
    //Retorna para o jogador o inicio do jogo
    io.sockets.in(data.gameId).emit('beginNewGame', data);
}

//Quando o contador finalizar o jogo se inicia

function hostStartGame(gameId) {
    console.log('Game Started.');
    sendWord(0,gameId);
};

//Quando um jogador responder corretamente é hora para o próximo round

function hostNextRound(data) {
    if(data.round < wordPool.length ){
        // Envia um novo conjunto do palavras para o jogador
        sendWord(data.round, data.gameId);
    } else {
        // Se o round atual umtrapassa a quantidade de palavras, acaba o jogo.
        io.sockets.in(data.gameId).emit('gameOver',data);
    }
}

/* *****************************
   *                           *
   *     Funções de jogador    *
   *                           *
   ***************************** */
   
//Quando um jogador clicar no botão START GAME, tenta conectar ele na sala que tiver o gameId que o jogador informou

function playerJoinGame(data) {

    // Uma referencia ao objeto socket.io do jogador
    var sock = this;

    // Procura pelo ID da sala no Socket.IO manager object.
    var room = gameSocket.manager.rooms["/" + data.gameId];

    // Se a sala existe...
    if( room != undefined ){
        // Adiciona o ID aos dados.
        data.mySocketId = sock.id;

        // Entra na sala
        sock.join(data.gameId);

        //informa os clientes que o jogador se juntou ao jogo
        io.sockets.in(data.gameId).emit('playerJoinedRoom', data);

    } else {
        // Caso contrário envie um erro informando que a sala não existe
        this.emit('error',{message: "Esta sala não existe."} );
    }
}

//Jogador encostou em uma palavra da lista.

function playerAnswer(data) {

    // A resposta do jogador é adiconada aos dados
    // Envia um evento com a resposta para que o host possa checa-la
    io.sockets.in(data.gameId).emit('hostCheckAnswer', data);
}

//Após o jogo acabar o jogador clica em reiniciar
function playerRestart(data) {

    // Envia os dados do jogador novamente para a sala
    data.playerId = this.id;
    io.sockets.in(data.gameId).emit('playerJoinedRoom',data);
}

/* *************************
   *                       *
   *  Logica do jogo       *
   *                       *
   ************************* */
   
//Pega uma palavra para o host e uma lista de palavras para o jogador

function sendWord(wordPoolIndex, gameId) {
    var data = getWordData(wordPoolIndex);
    io.sockets.in(data.gameId).emit('newWordData', data);
}

//Esta função pega as novas palavras e envia elas aos clientes

function getWordData(i){
    // Randomiza a ordem das palavras disponíveis 
    // A primeira palavra o array randomizado vai ser mostrada no host
    // O segundo elemento será escondido em uma lista de "iscas"
    var words = shuffle(wordPool[i].words);

    // Randomiza a ordem de palavras iscas e pegas as 5 primeiras
    var decoys = shuffle(wordPool[i].decoys).slice(0,5);

    // pega um lugar randomico na lista para colocar a resposta correta
    var rnd = Math.floor(Math.random() * 5);
    decoys.splice(rnd, 0, words[1]);

    // Junta as palavras em um objeto só
    var wordData = {
        round: i,
        word : words[0],   // Palavra do host
        answer : words[1], // Palavra correta
        list : decoys      // Iscas e respostas
    };

    return wordData;
}

//Javascript implementation of Fisher-Yates shuffle algorithm
// * http://stackoverflow.com/questions/2450954/how-to-randomize-a-javascript-array
 
 function shuffle(array) {
    var currentIndex = array.length;
    var temporaryValue;
    var randomIndex;

    //Enquanto ainda há elementos a serem randomizados...
    while (0 !== currentIndex) {

        // Pega os elementos que faltam...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // E troca ele com o elemento atual.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

//Cada um dos elementos no array nos dá palavras para um round
//em cada round, duas palavras randomicas de "words" são selecionadas como a palavra do host e a resposta correta.
//Cinco iscas são seleciondas de "decoys" e mostradas ao player.
//A resposta correta é incluida randomicamente na lista de iscas

var wordPool = [
    {
        "words"  : [ "sale","seal","ales","leas" ],
        "decoys" : [ "lead","lamp","seed","eels","lean","cels","lyse","sloe","tels","self" ]
    },

    {
        "words"  : [ "item","time","mite","emit" ],
        "decoys" : [ "neat","team","omit","tame","mate","idem","mile","lime","tire","exit" ]
    },

    {
        "words"  : [ "spat","past","pats","taps" ],
        "decoys" : [ "pots","laps","step","lets","pint","atop","tapa","rapt","swap","yaps" ]
    },

    {
        "words"  : [ "nest","sent","nets","tens" ],
        "decoys" : [ "tend","went","lent","teen","neat","ante","tone","newt","vent","elan" ]
    },

    {
        "words"  : [ "pale","leap","plea","peal" ],
        "decoys" : [ "sale","pail","play","lips","slip","pile","pleb","pled","help","lope" ]
    },

    {
        "words"  : [ "races","cares","scare","acres" ],
        "decoys" : [ "crass","scary","seeds","score","screw","cager","clear","recap","trace","cadre" ]
    },

    {
        "words"  : [ "bowel","elbow","below","beowl" ],
        "decoys" : [ "bowed","bower","robed","probe","roble","bowls","blows","brawl","bylaw","ebola" ]
    },

    {
        "words"  : [ "dates","stead","sated","adset" ],
        "decoys" : [ "seats","diety","seeds","today","sited","dotes","tides","duets","deist","diets" ]
    },

    {
        "words"  : [ "spear","parse","reaps","pares" ],
        "decoys" : [ "ramps","tarps","strep","spore","repos","peris","strap","perms","ropes","super" ]
    },

    {
        "words"  : [ "stone","tones","steno","onset" ],
        "decoys" : [ "snout","tongs","stent","tense","terns","santo","stony","toons","snort","stint" ]
    }
]