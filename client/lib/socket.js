import { io } from "socket.io-client";

let socket;

const SOCKET_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export const connectSocket = (token) => {
  socket = io(SOCKET_URL, {
    auth: { token },
    withCredentials: true,
  });

  return socket;
};

export const getSocket = () => socket;