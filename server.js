const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let waitingUser = null;

io.on('connection', (socket) => {
    console.log(`> Пользователь подключился: ${socket.id}`);

    socket.on('find_peer', () => {
        console.log(`> Поиск пары для: ${socket.id}`);

        if (waitingUser && waitingUser.id !== socket.id) {
            const roomName = `room_${socket.id}_${waitingUser.id}`;
            
            socket.join(roomName);
            waitingUser.join(roomName);

            io.to(roomName).emit('peer_connected', { room: roomName });
            console.log(`> Пара создана в комнате: ${roomName}`);
            waitingUser = null; 
        } else {
            waitingUser = socket;
            socket.emit('waiting_for_peer');
            console.log(`> Пользователь ${socket.id} отправлен в ожидание`);
        }
    });

    socket.on('leave_room', () => {
        if (waitingUser === socket) {
            waitingUser = null;
        }
        Array.from(socket.rooms).forEach(room => {
            if (room !== socket.id) {
                socket.leave(room);
                io.to(room).emit('peer_disconnected');
            }
        });
    });

    socket.on('disconnect', () => {
        console.log(`> Пользователь отключился: ${socket.id}`);
        if (waitingUser === socket) {
            waitingUser = null;
        }
        socket.broadcast.emit('peer_disconnected');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`> Радиостанция ECHO запущенна на порту: http://localhost:${PORT}`);
});