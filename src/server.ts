import express from "express";
import http from "http";
import { Server } from "socket.io";
import * as dotenv from "dotenv";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { Room } from "./types/room.type";
import { generateSlug } from "random-word-slugs";

dotenv.config();

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

app.get("/", function (_req, res) {
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
  logger.success("Client :socketId connected", { socketId: socket.id });
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
        if (room.leader === mapUser(socket.id)) {
          room.leader = Object.keys(room.likedPlaces)[0];
        }

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

    console.log("Rooms:", rooms);

    logger.error("Client :socketId disconnected", { socketId: socket.id });
  });

  socket.on("create_room", () => {
    const roomId = uuidv4();
    const slug = generateSlug(2);
    rooms.push({
      id: roomId,
      slug: slug,
      leader: mapUser(socket.id),
      likedPlaces: { [mapUser(socket.id)]: [] },
    });
    socket.join(roomId);
    logger.success("Client :socketId created a new room (:roomId)", {
      socketId: socket.id,
      roomId: slug,
    });
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
      logger.success("Client :socketId joined room (:roomId)", {
        socketId: socket.id,
        roomId: room.slug,
      });
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
