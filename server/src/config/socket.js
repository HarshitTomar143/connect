import { Server } from "socket.io";
import socketHandler from "../sockets/index.js";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
  });

  socketHandler(io);
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};