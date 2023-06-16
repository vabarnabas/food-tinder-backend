"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const dotenv = __importStar(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const uuid_1 = require("uuid");
const voucher_code_generator_1 = __importDefault(require("voucher-code-generator"));
dotenv.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: { origin: "*" },
});
app.get("/", function (req, res) {
    res.sendFile(__dirname + "/public/index.html");
});
let rooms = [];
io.on("connection", (socket) => {
    console.log(`✅ Client ${socket.id} connected`);
    function emitRoom(roomId) {
        const room = rooms.find((room) => room.id === roomId);
        if (room) {
            socket.emit("current_room", { room });
            socket.to(roomId).emit("current_room", { room });
        }
    }
    socket.on("disconnect", () => {
        const roomIds = rooms
            .filter((room) => Object.keys(room.likedPlaces).length !== 0 &&
            Object.keys(room.likedPlaces).includes(socket.id))
            .map((room) => room.id);
        rooms = rooms.map((room) => {
            if (Object.keys(room.likedPlaces).length !== 0 &&
                Object.keys(room.likedPlaces).includes(socket.id)) {
                const { [socket.id]: socketId, ...otherUsers } = room.likedPlaces;
                return { ...room, likedPlaces: otherUsers };
            }
            return room;
        });
        roomIds.forEach((id) => emitRoom(id));
        console.log(`⛔️ Client ${socket.id} disconnected`);
    });
    socket.on("message", (data) => {
        console.log(`📩 Client ${socket.id} sent message: ${data}`);
        io.emit("message", `${socket.id}: ${data}`);
    });
    socket.on("create_room", () => {
        const roomId = (0, uuid_1.v4)();
        const slug = voucher_code_generator_1.default.generate({
            count: 1,
            length: 8,
            charset: "abcdefghijklmnopqrstuvwxyz",
        });
        rooms.push({
            id: roomId,
            slug: slug[0],
            createdBy: socket.id,
            likedPlaces: { [socket.id]: [] },
        });
        socket.join(roomId);
        console.log(`🚪 Client ${socket.id} created a new room (${roomId})`);
        socket.emit("room_created", { roomId, slug: slug[0] });
        emitRoom(roomId);
    });
    socket.on("join_room", ({ roomId, slug }) => {
        const room = rooms.find((room) => room.id === roomId || room.slug === slug);
        if (room) {
            socket.join(room.id);
            rooms = rooms.map((item) => {
                if (item.id === room.id) {
                    return {
                        ...item,
                        likedPlaces: Object.assign({ [socket.id]: [] }, item.likedPlaces),
                    };
                }
                return item;
            });
            console.log(`✅🚪 Client ${socket.id} joined room (${room.id})`);
            emitRoom(room.id);
            socket.emit("room_joined", { roomId: room.id, slug: room.slug });
        }
        else {
            console.log(`⛔️🚪 Client ${socket.id} tried to join room (${roomId || slug}), but the room doesn't exists.`);
        }
    });
});
server.listen(process.env.PORT || 3000, () => {
    console.log(`🚀 Server is running on port ${process.env.PORT || 3000}`);
});
//# sourceMappingURL=server.js.map