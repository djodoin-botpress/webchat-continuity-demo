# webchat-continuity-demo

A tiny Node/Express app demonstrating **cross-device user continuity** for
[Botpress Webchat](https://botpress.com/docs/webchat). Log in with a
username on any browser/device and resume the same Botpress user — and the
same conversation history — that you had before.

The repo also includes a **static-only** variant (no backend) that explores
how the webchat persists identity to `localStorage`.

## How it works

```
┌─────────┐   POST /api/login         ┌─────────┐
│ Browser │ ───────────────────────▶  │ Node    │
│         │   { username }            │ server  │
│         │                           │         │
│         │                           │  POST {WEBCHAT_API}/:clientId/users
│         │                           │  { name: <username> }
│         │                           │         │
│         │                           │  ┌──────▼──────────┐
│         │                           │  │ Botpress Chat   │
│         │                           │  │ API             │
│         │                           │  └──────┬──────────┘
│         │                           │         │
│         │   { userId, userKey,      │         │
│         │     conversationId }      │         │
│         │ ◀───────────────────────  │         │
│         │                           └─────────┘
│         │
│         │ loads https://cdn.botpress.cloud/webchat/v3.6/inject.js
│         │ → window.botpress.init({ clientId })
│         │ → on 'webchat:initialized':
│         │     window.botpress.updateUser({ userKey })
│         │ → webchat associates the user and persists its own envelope
└─────────┘
```

1. The browser POSTs a username to `/api/login`.
2. The Node server looks up the username in `.data/users.json`. If unknown,
   it calls `POST https://webchat.botpress.cloud/<clientId>/users` to
   create a Botpress user and caches the returned `{ userId, userKey }`.
3. The server sets a `username` cookie and returns
   `{ userId, userKey, conversationId }` to the page.
4. The page loads the inject script and calls
   `window.botpress.init({ clientId })`. Once the `webchat:initialized`
   event fires, it associates the identity with the supported public API:
   `window.botpress.updateUser({ userKey })`. The webchat then persists its
   own `bp-webchat-<clientId>-client` localStorage envelope — the page no
   longer writes it.
5. As the webchat creates/loads a conversation, the page POSTs the
   `conversationId` back to `/api/conversation` so the next device that
   logs in with the same username also resumes the same conversation.

## Prerequisites

- Node.js ≥ 18 (uses native `fetch`)
- A Botpress Webchat `clientId`
  (Botpress Cloud → Webchat → Advanced → Configuration → clientId)

## Run

```bash
npm install
CLIENT_ID=<your-client-id> npm start
# → http://localhost:8000
```

Optional env vars:

| Var               | Default                             | Purpose                                |
|-------------------|-------------------------------------|----------------------------------------|
| `CLIENT_ID`       | _(required)_                        | Webchat clientId                       |
| `PORT`            | `8000`                              | Local server port                      |
| `WEBCHAT_API_URL` | `https://webchat.botpress.cloud`    | Override for non-default Chat API base |

## Try cross-device continuity

1. Open `http://localhost:8000` in browser A, log in as `alice`, send a message.
2. Open the same URL in browser B (different profile, incognito, or another
   device on your LAN — replace `localhost` with your machine's IP).
3. Log in as `alice` again. Same Botpress user, same conversation history.

To switch identities, click **Log out** — this clears the cookie and every
`bp-webchat-*` localStorage entry.

## API

| Method | Path                | Description                                                |
|--------|---------------------|------------------------------------------------------------|
| `GET`  | `/api/config`       | Returns `{ clientId }`                                     |
| `GET`  | `/api/me`           | Returns the current `{ user }` from cookie, or `null`      |
| `POST` | `/api/login`        | Body `{ username }`. Ensures Botpress user. Sets cookie.   |
| `POST` | `/api/logout`       | Clears the cookie                                          |
| `POST` | `/api/conversation` | Body `{ conversationId }`. Persists the current conv id    |

## Files

```
.
├── server.js              # Express app: /api/*, serves public/
├── public/
│   ├── index.html         # Login form → app view with the webchat
│   └── static-demo.html   # Standalone (no-backend) localStorage explorer
├── package.json
├── .gitignore             # excludes node_modules/, .data/
└── .data/users.json       # username → { userId, userKey, conversationId } (gitignored)
```

## Caveats

This is intentionally minimal:

- **No password.** Anyone who knows a username can resume that session.
- **No `userKey` refresh.** The JWT is cached forever in `.data/users.json`.
  When it eventually expires, the simplest fix is to delete the entry and
  log in again (which creates a new Botpress user) — or extend the server
  to call `generateUserKey` (requires an admin secret).
- **`conversationId` sync** only happens on the webchat's `conversation`
  event. Messages don't re-sync the id; if you want belt-and-suspenders,
  also POST from the `message` handler with a small debounce.
- **`x-admin-secret`** isn't used. With it, you can pre-create users with
  deterministic IDs and rotate user keys server-side.

## License

MIT
