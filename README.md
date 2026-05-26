# Alapon

Alapon is a Facebook-lite MERN social chatting application. It uses React, Tailwind CSS, Node, Express, MongoDB, Mongoose, JWT cookies, Socket.io, Multer, and Cloudinary.

## Architecture

```text
alapon/
  backend/
    src/
      config/          MongoDB and Cloudinary configuration
      controllers/     Request handlers grouped by feature
      middleware/      Auth, uploads, rate limiting, errors
      models/          Mongoose schemas and indexes
      routes/          Express route modules
      socket/          Socket.io events for presence, typing, messages
      utils/           Shared helpers
  frontend/
    src/
      components/      Reusable UI, layout, routing, post components
      context/         Auth and Socket providers
      lib/             Axios API client
      pages/           Route-level screens
```

## Data Model

- `User`: account, secure password hash, profile fields, friends, verification flags, last seen.
- `FriendRequest`: sender, receiver, pending/accepted/rejected/cancelled status.
- `Conversation`: two participants, last message, last activity date.
- `Message`: conversation, sender, text/image, delivered and seen metadata.
- `Post`: author, text/images, visibility, likes, comment count.
- `Comment`: post, author, text, likes.
- `Notification`: recipient, sender, type, linked entity, read timestamp.

## Feature Phases

1. Foundation: install dependencies, connect MongoDB, verify auth and protected routes.
2. Social graph: send, accept, reject, and remove friends; show friend lists and mutual friends.
3. Feed: text/image posts, likes, comments, edit/delete, infinite scroll.
4. Chat: conversation creation, message images, typing, seen/delivered, online status.
5. Notifications: friend request, message, like, comment notifications with realtime updates.
6. Polish: dark mode persistence, skeleton loaders, mobile nav, profile timeline, deployment.

## Setup

Install all dependencies:

```bash
npm run install:all
npm install
```

Create environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Update `backend/.env` with a real `JWT_SECRET`, `MONGO_URI`, and Cloudinary credentials.

Run the full app:

```bash
npm run dev
```

Backend runs on `http://localhost:5000`. Frontend runs on `http://localhost:5173`.

## Security Practices Included

- Password hashing with bcrypt.
- JWT authentication through secure HTTP-only cookies.
- CORS with credentials scoped to the frontend URL.
- Helmet, HPP, XSS clean, Mongo sanitize, JSON body limits.
- Auth-specific and global rate limiting.
- Protected route middleware.
- Multer file type and size limits.

## Main API Routes

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
POST   /api/v1/auth/forgot-password
PATCH  /api/v1/auth/reset-password/:token

GET    /api/v1/users/search?q=
GET    /api/v1/users/:id
PATCH  /api/v1/users/me/profile
POST   /api/v1/users/me/upload/:type

GET    /api/v1/friends/requests
POST   /api/v1/friends/request/:userId
PATCH  /api/v1/friends/request/:requestId
DELETE /api/v1/friends/:userId

GET    /api/v1/posts/feed
POST   /api/v1/posts
PATCH  /api/v1/posts/:postId
DELETE /api/v1/posts/:postId
POST   /api/v1/posts/:postId/like
GET    /api/v1/posts/:postId/comments
POST   /api/v1/posts/:postId/comments

GET    /api/v1/chats/conversations
POST   /api/v1/chats/conversations/:userId
GET    /api/v1/chats/conversations/:conversationId/messages
POST   /api/v1/chats/conversations/:conversationId/messages

GET    /api/v1/notifications
PATCH  /api/v1/notifications/read
```

## Next Implementation Targets

- Add request validation helpers for every write route.
- Add email provider integration for reset and verification emails.
- Add profile timeline endpoint and frontend rendering.
- Add friend request buttons with accepted/rejected states.
- Add infinite feed pagination and comment drawer.
- Persist dark mode preference in local storage.
