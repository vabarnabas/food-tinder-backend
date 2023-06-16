import express, { Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";
import * as dotenv from "dotenv";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { Room } from "./types/room.type";
import voucher_codes from "voucher-code-generator";

dotenv.config();

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/public/index.html");
});

let rooms: Room[] = [];

io.on("connection", (socket) => {
  console.log(`✅ Client ${socket.id} connected`);

  function emitRoom(roomId: string) {
    const room = rooms.find((room) => room.id === roomId);

    if (room) {
      socket.emit("current_room", { room });
      socket.to(roomId).emit("current_room", { room });
    }
  }

  socket.on("disconnect", () => {
    const roomIds = rooms
      .filter(
        (room) =>
          Object.keys(room.likedPlaces).length !== 0 &&
          Object.keys(room.likedPlaces).includes(socket.id)
      )
      .map((room) => room.id);

    rooms = rooms.map((room) => {
      if (
        Object.keys(room.likedPlaces).length !== 0 &&
        Object.keys(room.likedPlaces).includes(socket.id)
      ) {
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
    const roomId = uuidv4();
    const slug = voucher_codes.generate({
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
    } else {
      console.log(
        `⛔️🚪 Client ${socket.id} tried to join room (${
          roomId || slug
        }), but the room doesn't exists.`
      );
    }
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Server is running on port ${process.env.PORT || 3000}`);
});
