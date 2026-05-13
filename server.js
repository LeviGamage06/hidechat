const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A user connected. ID:', socket.id);

    socket.on('join room', (roomCode) => {
        socket.join(roomCode);
        console.log(`User ${socket.id} joined room: ${roomCode}`);
        socket.to(roomCode).emit('user joined');
    });

    socket.on('public key', (data) => {
        socket.to(data.room).emit('public key', data.key);
    });

    socket.on('chat message', (data) => {
        socket.to(data.room).emit('chat message', data);
    });

    
    socket.on('disconnecting', () => {
        socket.rooms.forEach(room => {
            if (room !== socket.id) {
                socket.to(room).emit('user left');
            }
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected. ID:', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
