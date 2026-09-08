const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Раздаем статику из папки public
app.use(express.static('public'));

// Хранятся пользователи, которые ищут собеседника
let waitingUser = null;

io.on('connection', (socket) => {
    console.log(`> Пользователь подключился: ${socket.id}`);

    // Поиск собеседника
    socket.on('find_peer', () => {
        // Если уже кто-то ждет в очереди (и это не он сам)
        if (waitingUser && waitingUser.id !== socket.id) {
            const roomName = `room_${socket.id}_${waitingUser.id}`;
            
            // До обоих пользователей в одну комнату
            socket.join(roomName);
            waitingUser.join(roomName);

            // Сообщаем обоим, что пара найдена
            io.to(roomName).emit('peer_connected', { room: roomName });

            console.log(`> Создана комната: ${roomName} между ${waitingUser.id} и ${socket.id}`);
            waitingUser = null; // Очищаем очередь
        } else {
            // Никого нет, ставим текущего в очередь
            waitingUser = socket;
            console.log(`> Пользователь ${socket.id} добавлен в очередь поиска.`);
        }
    });

    // Покинуть текущую комнату / сбросить собеседника
    socket.on('leave_room', () => {
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                socket.leave(room);
                // Оповестим второго участника, что партнер ушел
                socket.to(room).emit('peer_disconnected');
            }
        }
        if (waitingUser === socket) {
            waitingUser = null;
        }
    });

    // --- WebRTC Сигнализация (пересылка offer, answer, ICE-кандидатов) ---

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

    // Отключение пользователя
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
