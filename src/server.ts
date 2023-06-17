import express, { Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";
import * as dotenv from "dotenv";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { Room } from "./types/room.type";
import voucher_codes from "voucher-code-generator";
import { generateSlug } from "random-word-slugs";

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
let userMap: {};

function mapUser(socketId: string) {
  return userMap[socketId];
}

function stringBuilder(path: string, params?: Record<string, unknown>) {
  let localString: string = path;

  if (!params) return localString;

  Object.keys(params).forEach((key) => {
    const param = params[key];

    if (typeof param === "string" && localString.includes(`:${key}`)) {
      localString = localString.replace(`:${key}`, param);
    }
  });

  return localString;
}

const logger = {
  success: (message: string, params?: Record<string, string>) => {
    console.log(`✅ ${stringBuilder(message, params)}`);
  },
  error: (message: string, params?: Record<string, string>) => {
    console.log(`⛔️ ${stringBuilder(message, params)}`);
  },
  warning: (message: string, params?: Record<string, string>) => {
    console.log(`🟨 ${stringBuilder(message, params)}`);
  },
  info: (message: string, params?: Record<string, string>) => {
    console.log(`🚀 ${stringBuilder(message, params)}`);
  },
};

io.on("connection", (socket) => {
  console.log(`✅ Client ${socket.id} connected`);
  userMap = {
    ...userMap,
    [socket.id]: generateSlug(2, { categories: { noun: ["animals"] } }),
  };

  function emitRoom(roomId: string) {
    const room = rooms.find((room) => room.id === roomId);

    if (room) {
      socket.emit("current_room", { room, userMap });
      socket.to(roomId).emit("current_room", { room, userMap });
    }
  }

  socket.on("disconnect", () => {
    const roomIds = rooms
      .filter(
        (room) =>
          Object.keys(room.likedPlaces).length !== 0 &&
          Object.keys(room.likedPlaces).includes(mapUser(socket.id))
      )
      .map((room) => room.id);

    rooms = rooms
      .map((room) => {
        if (
          Object.keys(room.likedPlaces).length !== 0 &&
          Object.keys(room.likedPlaces).includes(mapUser(socket.id))
        ) {
          const { [mapUser(socket.id)]: socketId, ...otherUsers } =
            room.likedPlaces;

          return { ...room, likedPlaces: otherUsers };
        }

        return room;
      })
      .filter((room) => Object.keys(room.likedPlaces).length !== 0);

    roomIds.forEach((id) => emitRoom(id));

    console.log(`⛔️ Client ${socket.id} disconnected`);
  });

  socket.on("message", (data) => {
    console.log(`📩 Client ${socket.id} sent message: ${data}`);
    io.emit("message", `${socket.id}: ${data}`);
  });

  socket.on("create_room", () => {
    const roomId = uuidv4();
    const slug = generateSlug(2);
    rooms.push({
      id: roomId,
      slug: slug,
      createdBy: mapUser(socket.id),
      likedPlaces: { [mapUser(socket.id)]: [] },
    });
    socket.join(roomId);
    console.log(`🚪 Client ${socket.id} created a new room (${slug})`);
    socket.emit("room_created", { roomId, slug: slug });
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
            likedPlaces: Object.assign(
              { [mapUser(socket.id)]: [] },
              item.likedPlaces
            ),
          };
        }

        return item;
      });
      console.log(`✅🚪 Client ${socket.id} joined room (${room.id})`);
      emitRoom(room.id);
      socket.emit("room_joined", { roomId: room.id, slug: room.slug });
    } else {
      logger.error(
        "Client :socketId tried to join room (:roomId), but the room doesn't exists",
        { socketId: socket.id, roomId: roomId || slug }
      );
    }
  });
});

server.listen(process.env.PORT || 3000, () => {
  logger.info("Server is running on port :port", {
    port: (process.env.PORT || 3000).toString(),
  });
});
