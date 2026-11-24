# ChatApp – Real-Time Full-Stack Chat

Node.js + Express + Socket.IO + MongoDB Atlas (Mongoose) + JWT login, with a dark purple/blue glassmorphism frontend.

---

## Part 1 – What changed from your original project (in simple words)

| Your original | Now |
|---|---|
| `server.js` with a Socket.IO demo | `server.js` now only *starts* things. The work is split into folders so each file does one job. |
| `client.html` (a blank page that printed to the console) | Replaced by real pages in `public/`: `login.html`, `register.html`, `chat.html`. |
| Nobody logged in, nothing saved | Users register/log in (JWT + hashed passwords). Everything is saved in MongoDB. |

### Your Socket.IO events – what happened to each

| Event | Before | Now | Why it changed |
|---|---|---|---|
| `active` | Count sent only to the user who just connected | Number of **different users online**, sent to **everyone** whenever it changes | So every screen's "N online" stays live. |
| `chat` | `"Hello from server side"` | Personal greeting for the connected user (shown on the welcome screen) | Same idea, friendlier text. |
| `join` | Plain text `"New User Joined"` | `{ user }` – who joined | The app must know *who* to mark online. |
| `msg` | Client → server, only `console.log`ged | The real message event. Client sends `{to, text}`; server saves it to MongoDB and delivers it to the receiver | This is how chat works now. |
| `announce` | Hard-coded text sent to everyone on **every** connection | Text comes from `ANNOUNCEMENT` in `.env`, sent only to the user who connects | Old way spammed everybody each time someone joined. |
| `leave` *(new)* | – | `{ user }` when someone goes offline | You asked to show disconnects. |
| `read` *(new)* | – | Tells the sender their message was read (ticks turn blue) | Read status. |

Other small changes: the unused `events` package was removed, `bcryptjs` was used instead of `bcrypt` (see Part 7), and the Socket.IO client now loads from your own server (`/socket.io/socket.io.js`) instead of a CDN.

---

## Part 2 – Set up MongoDB Atlas (free)

1. Go to <https://www.mongodb.com/cloud/atlas/register> and create a free account.
2. Create a **free (M0) cluster**. Pick any provider/region near you. Wait 1–3 minutes.
3. **Create a database user:** left menu **Database Access → Add New Database User** → *Password* authentication. Choose a username (e.g. `chatuser`) and a password. **Use letters and numbers only** (symbols like `@` or `#` break the connection string). Role: *Read and write to any database*. Save the password somewhere private.
4. **Allow your computer:** left menu **Network Access → Add IP Address → Add Current IP Address** → Confirm. (For quick testing from anywhere you can use *Allow access from anywhere* `0.0.0.0/0`, but don't keep that for a real production app.)
5. **Get the connection string:** **Database → Connect → Drivers** → copy the string. It looks like:
   `mongodb+srv://chatuser:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`
6. In that string replace `<password>` with your real password (no `<` `>` brackets) and add the database name `chatapp` before the `?`:
   `mongodb+srv://chatuser:MyPass123@cluster0.abcde.mongodb.net/chatapp?retryWrites=true&w=majority`

You will paste this into your private `.env` file in Part 4. Never post it publicly.

---

## Part 3 – VS Code setup

1. Install **Node.js (LTS, version 18 or newer)** from <https://nodejs.org> and **VS Code** from <https://code.visualstudio.com>.
2. Unzip this project. In VS Code: **File → Open Folder…** and choose the `Chatapp` folder (the one containing `server.js`).
3. Open the terminal: **Terminal → New Terminal**.
4. Check Node works: `node -v` (should print v18 or higher).

## Part 4 – Install and run

```bash
# 1. Install all packages (reads package.json)
npm install

# 2. Create your private settings file
#    Windows (Command Prompt):   copy .env.example .env
#    Mac / Linux / Git Bash:     cp .env.example .env

# 3. Generate a secret for login tokens and copy the output
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Open the new `.env` file in VS Code and fill it in:

```
PORT=8080
MONGODB_URI=<your connection string from Part 2>
JWT_SECRET=<the long random text you just generated>
ANNOUNCEMENT=Welcome to ChatApp! Your messages are saved securely.
```

Start the server:

```bash
npm start            # normal start
npm run dev          # auto-restarts when you edit files (Node 18.11+)
```

You should see:

```
MongoDB connected: ...
Server started: http://localhost:8080
```

Open <http://localhost:8080> in your browser.

---

## Part 5 – How to test everything

**Registration & database**
1. Open <http://localhost:8080/register.html>, create user **Alice** (username `alice`, any email, password like `Alice1234`).
2. Try registering `alice` again → you should see "This username is already taken."
3. In Atlas: **Database → Browse Collections → chatapp → users**. Alice is there and her `password` is a long hash starting with `$2a$` / `$2b$` (never plain text).

**Login & JWT**
4. Click Logout, then log in at `/login.html` using the username *or* the email. A wrong password shows an error.
5. Tick "Keep me logged in" to stay logged in after closing the browser.
6. While logged out, open <http://localhost:8080/chat.html> → you are sent to the login page. Opening <http://localhost:8080/api/users> directly gives `{"message":"Please log in to continue."}` (protected route).

**Two users in real time**
7. Keep Alice in a normal window. Open a **private/incognito window** (or another browser) and register **Bob**.
8. Alice sees a "Bob is now online" popup and the "online" counter goes to 2.
9. In Alice's search box type `bob`, click him, type a message and press **Enter**. Bob receives it instantly with an unread badge.
10. Bob opens the chat: Alice's ticks turn blue (read). Reply from Bob.

**Persistence & status**
11. Stop the server (`Ctrl + C`), start it again, refresh both windows → the full history is still there (and it's in the `messages` collection in Atlas).
12. Close Bob's window → after ~3 seconds Alice sees "Bob went offline", and his status changes to "Last seen …".
13. Try **Delete conversation** (trash icon in the chat header) – it removes the chat from *your* view only; the other person keeps theirs.
14. Open the browser console (**F12 → Console**): there should be no red errors.

---

## Part 6 – Project structure

```
Chatapp/
├── server.js                  Starts Express, Socket.IO and MongoDB
├── package.json
├── .env.example               Template for your private .env
├── config/db.js               MongoDB connection
├── models/
│   ├── User.js                fullName, username, email, hashed password, profilePicture, isOnline, createdAt
│   ├── Message.js             conversation, sender, receiver, text, read, createdAt
│   └── Conversation.js        participants, lastMessage, updatedAt (+ per-user "deleted" markers)
├── middleware/
│   ├── auth.js                Checks the JWT on protected routes
│   ├── rateLimit.js           Slows down password guessing
│   └── errorHandler.js        Friendly error responses
├── controllers/               The logic behind each route
│   ├── authController.js
│   ├── userController.js
│   └── conversationController.js
├── routes/                    URL -> controller wiring
│   ├── auth.js
│   ├── users.js
│   └── conversations.js
├── socket/index.js            Real-time: authentication, online status, sending messages
├── utils/                     token.js, validators.js, serialize.js, conversations.js
└── public/                    Everything the browser loads
    ├── login.html  register.html  chat.html
    ├── css/  base.css  auth.css  chat.css
    └── js/   api.js  login.js  register.js  chat.js
```

### REST API (all except register/login need `Authorization: Bearer <token>`)

| Method & URL | What it does |
|---|---|
| `POST /api/auth/register` | Create account |
| `POST /api/auth/login` | Log in (`identifier`, `password`, `remember`) |
| `GET /api/auth/me` | Who am I? |
| `GET /api/users?search=` | Search users by username or name |
| `GET /api/users/online` | Users online now |
| `PATCH /api/users/me` | Update my name / profile picture link |
| `GET /api/conversations` | My chats with last message + unread count |
| `POST /api/conversations` | Start or open a chat with `userId` |
| `GET /api/conversations/:id/messages` | Chat history (`limit`, `before`) |
| `POST /api/conversations/:id/read` | Mark messages as read |
| `DELETE /api/conversations/:id` | Delete chat from my view |

### Security checklist (what is implemented)
- Passwords are hashed (bcrypt algorithm) – never stored or returned in plain text.
- JWT required on every protected route **and** on every Socket.IO connection.
- Users can only open conversations they belong to (others get "not found").
- Input is validated on the server (names, username, email, password rules, message length 1–2000).
- Messages are drawn on screen as plain text, so nobody can inject HTML/JavaScript.
- Secrets live in `.env` (which `.gitignore` keeps out of Git); the browser never sees them.
- Login/registration attempts are rate limited; message flooding is limited.

---

## Part 7 – Notes and troubleshooting

- **Why `bcryptjs` and not `bcrypt`?** `bcrypt` needs a C++ compiler on some computers and often fails to install for beginners. `bcryptjs` produces the same bcrypt hashes in plain JavaScript, with no install problems.
- **"Missing in your .env file"** – you didn't create `.env` (copy `.env.example`) or left a value empty.
- **"Could not connect to MongoDB"** – check (1) the password in `MONGODB_URI` has no `<` `>` and only letters/numbers, (2) your IP is in Atlas **Network Access**, (3) the cluster is finished starting.
- **`EADDRINUSE` (port in use)** – change `PORT` in `.env` (e.g. 3000) or close the other program using 8080.
- **Logged out unexpectedly** – a JWT expires after 1 day (30 days with "Keep me logged in"). Just log in again.
- **Profile picture** – paste a link to an image (https://…). Without one you get colored initials.
- Online/offline status is tracked per server process. This app is designed to run as a single server instance.
