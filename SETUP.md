# Connect - Installation & Setup Guide

## Quick Start

### Prerequisites
- Node.js (v22+)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

#### 1. Clone Repository
```bash
cd connect
```

#### 2. Backend Setup
```bash
cd server
npm install
```

**Create `.env` file:**
```env
MONGO_URI=mongodb://localhost:27017/connect
JWT_SECRET=your_jwt_secret_key_here
PORT=5000
CLIENT_URL=http://localhost:3000
```

#### 3. Frontend Setup
```bash
cd ../client
npm install
```

### Running the Application

#### Terminal 1 - Backend Server
```bash
cd server
npm run dev
```
Backend will start on `http://localhost:5000`

#### Terminal 2 - Frontend Server
```bash
cd client
npm run dev
```
Frontend will start on `http://localhost:3000`

### Building for Production

#### Frontend
```bash
cd client
npm run build
npm start
```

#### Backend
```bash
cd server
npm run build  # if applicable
npm start
```

---

## Features

### 1. **Profile Management**
- Set display name, nickname, about status
- Upload avatar URL
- Update profile anytime

### 2. **User Discovery**
- Search users by name, nickname, or email
- See online/offline status
- See last seen timestamp
- Start new conversations

### 3. **Real-time Messaging**
- Instant message delivery via Socket.io
- Full chat history with pagination
- "Load Earlier Messages" button
- Auto-scroll to newest messages

### 4. **Read Receipts**
- Single ✓ for delivered messages
- Double ✓✓ for read messages
- Toggle in settings

### 5. **Presence & Status**
- See who's online (green dot)
- Last seen timestamp
- Typing indicator
- Toggle visibility in settings

### 6. **Privacy Controls**
- Toggle read receipts
- Toggle last seen visibility
- Toggle location sharing
- Share GPS location with contacts

### 7. **Security**
- XSS protection via DOMPurify
- JWT authentication
- Password hashing with bcrypt
- Secure cookie storage

---

## Key Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get profile
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/users` - Get all users (search available)

### Messages
- `GET /api/messages/:conversationId` - Get messages with pagination
- `POST /api/messages` - Send message

### Conversations
- `POST /api/conversations` - Create/get conversation
- `GET /api/conversations` - Get all user conversations

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings

---

## Socket Events

**Client → Server:**
- `sendMessage` - Send message via socket
- `joinConversation` - Join chat room
- `markAsRead` - Mark message as read
- `typing` - Send typing indicator
- `updateSettings` - Update privacy settings

**Server → Client:**
- `newMessage` - New message received
- `messageRead` - Message was read
- `messageDelivered` - Message delivered
- `presence` - User online/offline status
- `userSettingsUpdated` - User settings changed
- `typing` - User is typing
- `missedMessages` - Messages sent while offline

---

## Configuration

### Environment Variables

**.env (Server)**
```env
MONGO_URI=mongodb://localhost:27017/connect
JWT_SECRET=your_secret_key
PORT=5000
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

### Ports
- Backend: 5000
- Frontend: 3000

---

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check MongoDB is running
mongosh

# Or use MongoDB Atlas connection string in .env
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/connect
```

### Port Already in Use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Or use different port in .env
PORT=5001
```

### Socket Connection Issues
- Clear browser cache
- Check CORS settings in `server/src/config/socket.js`
- Ensure CLIENT_URL in .env matches frontend URL

### Build Errors
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Project Structure

```
connect/
├── client/                 # Next.js Frontend
│   ├── app/               # Pages: dashboard, profile, auth
│   ├── components/        # UI components
│   ├── context/           # React context (Auth, Socket)
│   └── lib/               # Utilities (API, socket, sanitize)
│
└── server/                # Express Backend
    ├── src/
    │   ├── controllers/   # Business logic
    │   ├── models/        # MongoDB schemas
    │   ├── routes/        # API routes
    │   ├── sockets/       # Socket handlers
    │   ├── middleware/    # Auth, error handling
    │   └── config/        # Database, socket config
    └── package.json
```

---

## Development Tips

### Hot Reload
- Frontend: Automatic (Next.js)
- Backend: Automatic (nodemon)

### Database Inspection
```bash
# Connect to MongoDB
mongosh

# Use database
use connect

# Check collections
show collections

# Sample queries
db.users.find()
db.messages.find()
db.conversations.find()
```

### Socket Debugging
Add to client code:
```javascript
socketRef.current?.on('connect', () => console.log('Connected'));
socketRef.current?.on('disconnect', () => console.log('Disconnected'));
```

---

## Performance Notes

- Messages paginated: 20 per page
- Auto-reconnection on socket disconnect
- Optimized socket rooms (per conversation)
- Database indexes on frequently queried fields
- Lazy loading of historical messages

---

## Security Notes

- All messages sanitized for XSS
- JWT tokens expire in 15 minutes
- Passwords hashed with bcrypt
- CORS enabled for specified origins
- User data validated server-side
- Private user information (lastSeen, location) respects privacy settings

---

## Version Info

- Node.js: v22+
- MongoDB: 4.0+
- Next.js: 16.1.6
- React: 19
- Socket.io: 4.8.3
- Express: Latest

---

## Support

For issues or questions, check:
1. Terminal outputs for error messages
2. Browser console (F12) for client errors
3. MongoDB connection status
4. Network tab for API/Socket issues

---

**Ready to chat! 🚀**
