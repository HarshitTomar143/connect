# 🚀 Connect -- Real-Time Chat Application

Connect is a full-stack real-time chat application built using
**Next.js, Node.js, Express, MongoDB, and Socket.io**.

It enables secure authentication, real-time messaging, and persistent
chat storage with production-ready deployment.

------------------------------------------------------------------------

## 🌍 Live Demo

-   **Frontend:** https://connect-delta-rosy.vercel.app\
-   **Backend:** https://connect-cs4n.onrender.com

------------------------------------------------------------------------

## 📌 Features

-   🔐 JWT Authentication (HTTP-only cookies)
-   ⚡ Real-time messaging using Socket.io
-   💬 Private conversations
-   🧑 User profile system
-   💾 Persistent message storage (MongoDB Atlas)
-   🌐 Production-ready deployment (Render + Vercel)

------------------------------------------------------------------------

## 🛠 Tech Stack

### Frontend

-   Next.js (App Router)
-   Axios
-   Socket.io-client
-   TailwindCSS

### Backend

-   Node.js
-   Express.js
-   Socket.io
-   JWT Authentication
-   bcryptjs

### Database

-   MongoDB Atlas

### Deployment

-   Frontend → Vercel
-   Backend → Render

------------------------------------------------------------------------

## 📂 Project Structure

    connect/
    │
    ├── server/              # Backend (Node + Express + Socket.io)
    │   ├── src/
    │   │   ├── config/
    │   │   ├── controllers/
    │   │   ├── middleware/
    │   │   ├── models/
    │   │   ├── routes/
    │   │   ├── app.js
    │   │   └── server.js
    │
    ├── client/              # Frontend (Next.js)
    │   ├── app/
    │   ├── lib/
    │   ├── components/
    │   └── package.json
    │
    └── README.md

------------------------------------------------------------------------

# ⚙️ Local Development Setup

## 1️⃣ Clone the Repository

``` bash
git clone https://github.com/yourusername/connect.git
cd connect
```

------------------------------------------------------------------------

# 🔧 Backend Setup

``` bash
cd server
npm install
```

Create a `.env` file inside `/server`:

    PORT=5000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_secret_key
    NODE_ENV=development

Start backend:

``` bash
npm run dev
```

Backend runs at: http://localhost:5000

------------------------------------------------------------------------

# 💻 Frontend Setup

``` bash
cd ../client
npm install
```

Create `.env.local` inside `/client`:

    NEXT_PUBLIC_API_URL=http://localhost:5000

Start frontend:

``` bash
npm run dev
```

Frontend runs at: http://localhost:3000

------------------------------------------------------------------------

# 🔐 Authentication Flow

1.  User logs in.
2.  Backend generates JWT.
3.  JWT is stored in HTTP-only cookie.
4.  Protected routes verify token from cookie.
5.  Socket authentication passes token via `auth` object.

------------------------------------------------------------------------

# 📡 API Endpoints

## Auth

    POST   /api/auth/register
    POST   /api/auth/login
    GET    /api/auth/profile
    POST   /api/auth/logout

## Users

    GET    /api/users

## Messages

    POST   /api/messages
    GET    /api/messages/:conversationId

------------------------------------------------------------------------

# 🔌 Socket Events

### Client → Server

    joinConversation
    sendMessage

### Server → Client

    newMessage
    messageDelivered
    missedMessages

------------------------------------------------------------------------

# 🧪 Test Credentials

    Email: test1@mail.com
    Password: 123456

------------------------------------------------------------------------

# 🚀 Production Deployment

## Backend (Render)

-   Root Directory → `server`
-   Build Command: npm install
-   Start Command: node src/server.js

Environment Variables:

    PORT=5000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_secret_key
    NODE_ENV=production

## Frontend (Vercel)

-   Root Directory → `client`
-   Framework Preset → Next.js
-   Environment Variable:

```{=html}
<!-- -->
```
    NEXT_PUBLIC_API_URL=https://your-render-backend.onrender.com

------------------------------------------------------------------------

# 🔒 Production Configuration

### Cookie Setup

``` javascript
res.cookie("token", token, {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 3 * 60 * 60 * 1000,
});
```

### CORS Setup

``` javascript
app.use(
  cors({
    origin: "https://your-vercel-app.vercel.app",
    credentials: true,
  })
);
```

### Axios Setup

``` javascript
const API = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  withCredentials: true,
});
```

------------------------------------------------------------------------

# 👨‍💻 Author

Harshit Tomar\
Full-Stack Developer

------------------------------------------------------------------------

# ⭐ Support

If you found this project useful, consider giving it a ⭐ on GitHub.
