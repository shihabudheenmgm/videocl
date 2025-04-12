import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

const rooms = new Map();

const PORT = process.env.PORT || 5000;

// Create Room
app.post("/create-room", (req, res) => {
  const { roomId } = req.body;

  if (!roomId) return res.status(400).json({ error: "Room ID is required" });

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
    return res.status(201).json({ message: "Room created" });
  }

  return res.status(200).json({ message: "Room already exists" });
});

// Check Room
app.get("/check-room/:roomId", (req, res) => {
  const { roomId } = req.params;
  const exists = rooms.has(roomId);
  res.json({ exists });
});

// Socket.io Events
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  socket.on("join-room", ({ roomId, name }) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    rooms.get(roomId).add(socket.id);
    socket.join(roomId);

    // Notify others in room
    socket.to(roomId).emit("user-joined", { id: socket.id, name });

    socket.on("disconnect", () => {
      if (rooms.has(roomId)) {
        rooms.get(roomId).delete(socket.id);
        if (rooms.get(roomId).size === 0) {
          rooms.delete(roomId);
        }
      }
      socket.to(roomId).emit("user-left", socket.id);
    });
  });

  socket.on("sending-signal", ({ to, from, signal, name }) => {
    io.to(to).emit("user-signal", { signal, from, name });
  });

  socket.on("returning-signal", ({ to, signal, from }) => {
    io.to(to).emit("receive-returned-signal", { signal, from });
  });

  socket.on("send-message", ({ roomId, message, sender }) => {
    io.to(roomId).emit("receive-message", { message, sender });
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    for (const [roomId, users] of rooms.entries()) {
      users.delete(socket.id);
      socket.to(roomId).emit("user-left", socket.id);
      if (users.size === 0) {
        rooms.delete(roomId);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
