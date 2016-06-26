// Importa o módulo Express
var express = require('express');

// Importa o modulo 'path' (incluido no Node.js)
var path = require('path');

// Importa o arquivo do jogo
var ana = require('./anagrumrun');

// instancia um objeto do tipo express
var app = express();

// Cria uma aplicação Express
app.configure(function() {
    // desativa o logging
    app.use(express.logger('dev'));

    // define public como o diretório a ser servido
    app.use(express.static(path.join(__dirname,'public')));
});

// Cria um http server baseado em node.js na porta 8080
var server = require('http').createServer(app).listen(process.env.PORT || 8080);


// Cria um servidor socket.io junto ao http server
var io = require('socket.io').listen(server);

// diminui o logging do socket.io
io.set('log level',1);

// Escuta conexões do socket.io. Ao ser conectado inicia a logica do jogo.
io.sockets.on('connection', function (socket) {
    ana.initGame(io, socket);
});
