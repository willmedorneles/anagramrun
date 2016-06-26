
jQuery(function($){    
    'use strict';

    //O código relevante ao Socket.io está no namespace IO
    var IO = {

        //Isto é chamado quando a página é mostrada. Conecta o cliente socket.io ao servidor 
        init: function() {
            IO.socket = io.connect()
            {
                transports: ['websockets'];
            };
            
            IO.bindEvents();
        },

        //Enquanto conectado, o socket io irá escutar aos seguintes eventos emitidos pelo Socket.IO server, e então rodar a função apropriada
        bindEvents : function() {
            IO.socket.on('connected', IO.onConnected );
            IO.socket.on('newGameCreated', IO.onNewGameCreated );
            IO.socket.on('playerJoinedRoom', IO.playerJoinedRoom );
            IO.socket.on('beginNewGame', IO.beginNewGame );
            IO.socket.on('newWordData', IO.onNewWordData);
            IO.socket.on('hostCheckAnswer', IO.hostCheckAnswer);
            IO.socket.on('gameOver', IO.gameOver);
            IO.socket.on('error', IO.error );
        },

        /**
         * O cliente conectou
         */
        onConnected : function() {
            // Cache uma cópia do ID do scoket IO no APP
            App.mySocketId = IO.socket.socket.sessionid;

        },

        
        //Um novo jogo foi criado e um ID foi gerado
         
        onNewGameCreated : function(data) {
            App.Host.gameInit(data);
        },

        //Um jogador se juntou ao jogo
        playerJoinedRoom : function(data) {
            // Quando um jogador se junta a sala, faça a função updateWaitingScreen.
            // A duas funções com este nome uma do host e outra do player
            //Então no host a função App.Host.updateWiatingScreen é chamada
            //E no jogador, App.Player.updateWaitingScreen é chamada.
            App[App.myRole].updateWaitingScreen(data);
        },

        //dois jogadores entraram no jogo
        beginNewGame : function(data) {
            App[App.myRole].gameCountdown(data);
        },

        //Um novo conjunto de palavras é enviado pelo servidor
        onNewWordData : function(data) {
            // Atualiza o round atual
            App.currentRound = data.round;

            // Muda a palavra para o host e o jogador
            App[App.myRole].newWord(data);
        },

        //Um Jogador respondeu. Se este é o host, checa a resposta.
        hostCheckAnswer : function(data) {
            if(App.myRole === 'Host') {
                App.Host.checkAnswer(data);
            }
        },

        //Avisa a todos que o jogo acabou
        gameOver : function(data) {
            App[App.myRole].endGame(data);
        },

       //erro.
        error : function(data) {
            alert(data.message);
        }

    };

    var App = {

        //Mantem referencia ao gameId que é identico ao ID do Socket.IO usado para a comunicação do host e players
        gameId: 0,

        //Usado para diferenciar entre player e host
        myRole: '',   // 'Player' ou 'Host'

       //O identificador do Socket.IO. Gerado na primeira conexão com o servidor
        mySocketId: '',

        //Identifica o round atual
        currentRound: 0,

        /* *************************************
         *                Setup                *
         * *********************************** */

        //Roda quando a pagina carrega
        init: function () {
            App.cacheElements();
            App.showInitScreen();
            App.bindEvents();

            // Inicia fastclick library
            FastClick.attach(document.body);
        },

       //Cria referencias aos objetos que são mostrados em cena durante o jogo
        cacheElements: function () {
            App.$doc = $(document);

            // Templates
            App.$gameArea = $('#gameArea');
            App.$templateIntroScreen = $('#intro-screen-template').html();
            App.$templateNewGame = $('#create-game-template').html();
            App.$templateJoinGame = $('#join-game-template').html();
            App.$hostGame = $('#host-game-template').html();
        },

        //Cria click handlers para os botões do jogo
        bindEvents: function () {
            // Host
            App.$doc.on('click', '#btnCreateGame', App.Host.onCreateClick);

            // Player
            App.$doc.on('click', '#btnJoinGame', App.Player.onJoinClick);
            App.$doc.on('click', '#btnStart',App.Player.onPlayerStartClick);
            App.$doc.on('click', '.btnAnswer',App.Player.onPlayerAnswerClick);
            App.$doc.on('click', '#btnPlayerRestart', App.Player.onPlayerRestart);
        },

        /* *************************************
         *             Game Logic              *
         * *********************************** */

        //mostra a tela inicial
        showInitScreen: function() {
            App.$gameArea.html(App.$templateIntroScreen);
            App.doTextFit('.title');
        },


        /* *******************************
           *         HOST CODE           *
           ******************************* */
        Host : {

            //contem referencias ao jogador
            players : [],

            //Variavel usada para reiniciar o jogo sem recarregar a página
            isNewGame : false,

            //numero de jogadores atuais
            numPlayersInRoom: 0,

            //referencia a resposta correta do round atual
            currentCorrectAnswer: '',

           //Handler para o botão START
            onCreateClick: function () {
                // console.log('Clicked "Create A Game"');
                IO.socket.emit('hostCreateNewGame');
            },

           //a tela do host é mostrada
            gameInit: function (data) {
                App.gameId = data.gameId;
                App.mySocketId = data.mySocketId;
                App.myRole = 'Host';
                App.Host.numPlayersInRoom = 0;

                App.Host.displayNewGameScreen();
            },

            //mostra a tela que contem o ID e a URL
            displayNewGameScreen : function() {
                // Envia o html
                App.$gameArea.html(App.$templateNewGame);

                // mostra URL
                $('#gameURL').text(window.location.href);
                App.doTextFit('#gameURL');

                // Mostra o ID
                $('#spanNewGameCode').text(App.gameId);
            },

            //Atualiza a tela do host quando o primeiro jogador entra
            updateWaitingScreen: function(data) {
                // Se o jogo é reiniciado mostra a tela
                if ( App.Host.isNewGame ) {
                    App.Host.displayNewGameScreen();
                }
                // Atualiza a tela
                $('#playersWaiting')
                    .append('<p/>')
                    .text('Player ' + data.playerName + ' joined the game.');

                // Guarda os dados dos novos jogadores no host
                App.Host.players.push(data);

                // Incrementa o numero de jogadores na sala
                App.Host.numPlayersInRoom += 1;

                // Se dois jogadores se juntaram, inicia o jogo
                if (App.Host.numPlayersInRoom === 2) {

                    // Informa o host que os jogadores estão prontos
                    IO.socket.emit('hostRoomFull',App.gameId);
                }
            },

            //Mostra o contador
            gameCountdown : function() {

                //Prepara a tela com o novo HTML
                App.$gameArea.html(App.$hostGame);
                App.doTextFit('#hostWord');

                // Inicia o contador na tela
                var $secondsLeft = $('#hostWord');
                App.countDown( $secondsLeft, 5, function(){
                    IO.socket.emit('hostCountdownFinished', App.gameId);
                });

                // Mostra o nome dos jogadores
                $('#player1Score')
                    .find('.playerName')
                    .html(App.Host.players[0].playerName);

                $('#player2Score')
                    .find('.playerName')
                    .html(App.Host.players[1].playerName);

                // Coloca o score como 0
                $('#player1Score').find('.score').attr('id',App.Host.players[0].mySocketId);
                $('#player2Score').find('.score').attr('id',App.Host.players[1].mySocketId);
            },

            //mostra a palavra deste round
            newWord : function(data) {
                // coloca a palavra no DOM
                $('#hostWord').text(data.word);
                App.doTextFit('#hostWord');

                // UAtualiza os dados do novo round
                App.Host.currentCorrectAnswer = data.answer;
                App.Host.currentRound = data.round;
            },

            //Checa a resposta que o player clicou
            checkAnswer : function(data) {
                // Se a resposta é deste round
                if (data.round === App.currentRound){

                    // pega pontuação
                    var $pScore = $('#' + data.playerId);

                    // Se correto incrementa o score
                    if( App.Host.currentCorrectAnswer === data.answer ) {
                        // +5 pontos se correto
                        $pScore.text( +$pScore.text() + 5 );

                        // Avança o round
                        App.currentRound += 1;

                        //Prepara os dados para enviar ao servidor
                        var data = {
                            gameId : App.gameId,
                            round : App.currentRound
                        }

                        // Notifica o servidor para iniciar o proximo round
                        IO.socket.emit('hostNextRound',data);

                    } else {
                        //Se errado -3
                        $pScore.text( +$pScore.text() - 3 );
                    }
                }
            },


            //Acabou os 10 round, acaba o jogo
            endGame : function(data) {
                // Pega os dados do jogador 1 para a tela
                var $p1 = $('#player1Score');
                var p1Score = +$p1.find('.score').text();
                var p1Name = $p1.find('.playerName').text();

                // Pega os dados do jogador 2 para a tela
                var $p2 = $('#player2Score');
                var p2Score = +$p2.find('.score').text();
                var p2Name = $p2.find('.playerName').text();

                // Acha o ganhador
                var winner = (p1Score < p2Score) ? p2Name : p1Name;
                var tie = (p1Score === p2Score);

                // Mostra o resultado
                if(tie){
                    $('#hostWord').text("It's a Tie!");
                } else {
                    $('#hostWord').text( winner + ' Wins!!' );
                }
                App.doTextFit('#hostWord');

                // Reseta os daods
                App.Host.numPlayersInRoom = 0;
                App.Host.isNewGame = true;
            },

            //jogador reiniciou o jogo 
            restartGame : function() {
                App.$gameArea.html(App.$templateNewGame);
                $('#spanNewGameCode').text(App.gameId);
            }
        },


        /* *****************************
           *        PLAYER CODE        *
           ***************************** */

        Player : {

           //Referencia ao SOcket.io do host
            hostSocketId: '',

            //o nome do jogador
            myName: '',

            //handler do clique no botão START
            onJoinClick: function () {

                // mostra o HTML
                App.$gameArea.html(App.$templateJoinGame);
            },

           //O jogador colocou os dados
            onPlayerStartClick: function() {

                // Pega os dados para mandar aos jogadores
                var data = {
                    gameId : +($('#inputGameId').val()),
                    playerName : $('#inputPlayerName').val() || 'anon'
                };

                //Envia os dados do jogador e o ID para o player
                IO.socket.emit('playerJoinGame', data);

                // seta as propriedades para o player atual
                App.myRole = 'Player';
                App.Player.myName = data.playerName;
            },

            //Handler para a lista de palavras
            onPlayerAnswerClick: function() {

                var $btn = $(this);      // O botão
                var answer = $btn.val(); // A palavra

                // envia os dados da resposta apra o servidor.
                // O host pode verificar o resultado
                var data = {
                    gameId: App.gameId,
                    playerId: App.mySocketId,
                    answer: answer,
                    round: App.currentRound
                }
                IO.socket.emit('playerAnswer',data);
            },

            //handler apra o botão de iniciar novamente
            onPlayerRestart : function() {
                var data = {
                    gameId : App.gameId,
                    playerName : App.Player.myName
                }
                IO.socket.emit('playerRestart',data);
                App.currentRound = 0;
                $('#gameArea').html("<h3>Waiting on host to start new game.</h3>");
            },

           //mostra a tela de espera para o jogador 1
            updateWaitingScreen : function(data) {
                if(IO.socket.socket.sessionid === data.mySocketId){
                    App.myRole = 'Player';
                    App.gameId = data.gameId;

                    $('#playerWaitingMessage')
                        .append('<p/>')
                        .text('Joined Game ' + data.gameId + '. Please wait for game to begin.');
                }
            },

           //Mostra Get ready quando o jogo estiver para começar
            gameCountdown : function(hostData) {
                App.Player.hostSocketId = hostData.mySocketId;
                $('#gameArea')
                    .html('<div class="gameOver">Get Ready!</div>');
            },

            //mostra a lista de palavras
            newWord : function(data) {
                // Cria uma ul
                var $list = $('<ul/>').attr('id','ulAnswers');

                // inserte um li apra cada palavra
                // recebida do servidor
                $.each(data.list, function(){
                    $list                                //  <ul> </ul>
                        .append( $('<li/>')              //  <ul> <li> </li> </ul>
                            .append( $('<button/>')      //  <ul> <li> <button> </button> </li> </ul>
                                .addClass('btnAnswer')   //  <ul> <li> <button class='btnAnswer'> </button> </li> </ul>
                                .addClass('btn')         //  <ul> <li> <button class='btnAnswer'> </button> </li> </ul>
                                .val(this)               //  <ul> <li> <button class='btnAnswer' value='word'> </button> </li> </ul>
                                .html(this)              //  <ul> <li> <button class='btnAnswer' value='word'>word</button> </li> </ul>
                            )
                        )
                });

                // insere a lista na tela
                $('#gameArea').html($list);
            },

            /**
             *motra o game over
             */
            endGame : function() {
                $('#gameArea')
                    .html('<div class="gameOver">Game Over!</div>')
                    .append(
                        // cria o botão para começar novamente
                        $('<button>Start Again</button>')
                            .attr('id','btnPlayerRestart')
                            .addClass('btn')
                            .addClass('btnGameOver')
                    );
            }
        },


       
        countDown : function( $el, startTime, callback) {


            $el.text(startTime);
            App.doTextFit('#hostWord');


            var timer = setInterval(countItDown,1000);


            function countItDown(){
                startTime -= 1
                $el.text(startTime);
                App.doTextFit('#hostWord');

                if( startTime <= 0 ){
                   
                    clearInterval(timer);
                    callback();
                    return;
                }
            }

        },

       
        doTextFit : function(el) {
            textFit(
                $(el)[0],
                {
                    alignHoriz:true,
                    alignVert:false,
                    widthOnly:true,
                    reProcess:true,
                    maxFontSize:300
                }
            );
        }

    };

    IO.init();
    App.init();

}($));

