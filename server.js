const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingUser = null;

io.on('connection', (socket) => {
    console.log(`> Пользователь подключился: ${socket.id}`);

    socket.on('find_peer', () => {
        if (waitingUser && waitingUser.id !== socket.id) {
            const roomName = `room_${socket.id}_${waitingUser.id}`;
            
            socket.join(roomName);
            waitingUser.join(roomName);

            // Передаем каждому ID партнера, чтобы клиенты понимали роли
            socket.emit('peer_connected', { room: roomName, peerId: waitingUser.id });
            waitingUser.emit('peer_connected', { room: roomName, peerId: socket.id });

            console.log(`> Создана комната: ${roomName} между ${waitingUser.id} и ${socket.id}`);
            waitingUser = null;
        } else {
            waitingUser = socket;
            console.log(`> Пользователь ${socket.id} добавлен в очередь поиска.`);
        }
    });

    socket.on('leave_room', () => {
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                socket.leave(room);
                socket.to(room).emit('peer_disconnected');
            }
        }
        if (waitingUser === socket) {
            waitingUser = null;
        }
    });

    socket.on('offer', (data) => {
        const room = Array.from(socket.rooms).find(r => r !== socket.id);
        if (room) {
            socket.broadcast.to(room).emit('offer', data);
        }
    });

    socket.on('answer', (data) => {
        const room = Array.from(socket.rooms).find(r => r !== socket.id);
        if (room) {
            socket.broadcast.to(room).emit('answer', data);
        }
    });

    socket.on('ice_candidate', (data) => {
        const room = Array.from(socket.rooms).find(r => r !== socket.id);
        if (room) {
            socket.broadcast.to(room).emit('ice_candidate', data);
        }
    });

    socket.on('disconnect', () => {
        console.log(`> Пользователь отключился: ${socket.id}`);
        if (waitingUser === socket) {
            waitingUser = null;
        }
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                socket.to(room).emit('peer_disconnected');
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`> Сервер запущен на порту ${PORT}`);
});
