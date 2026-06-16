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
│         │   { username }            │ server  │  (no Botpress call —
│         │                           │         │   just cookie + conv store)
│         │   { username, userKey,    │         │
│         │     conversationId }      │         │
│         │ ◀───────────────────────  │         │  userKey === username
│         │                           └─────────┘
│         │
│         │ loads https://cdn.botpress.cloud/webchat/v3.6/inject.js
│         │ → window.botpress.init({ clientId })
│         │ → on 'webchat:initialized':
│         │     window.botpress.updateUser({ userKey })   ──▶ Botpress Chat API
│         │ → webchat associates (or lazily creates) the user keyed by userKey
└─────────┘
```

1. The browser POSTs a username to `/api/login`.
2. The Node server records the username in `.data/users.json` (just to remember
   its `conversationId`) and sets a `username` cookie. It makes **no** call to
   Botpress — the webchat associates the user itself.
3. The server returns `{ username, userKey, conversationId }`, where
   `userKey === username`.
4. The page loads the inject script and calls
   `window.botpress.init({ clientId })`. Once the `webchat:initialized`
   event fires, it associates the identity with the supported public API:
   `window.botpress.updateUser({ userKey })`. The webchat associates (or
   lazily creates) the Botpress user keyed by that `userKey` and persists its
   own `bp-webchat-<clientId>-client` localStorage envelope.
5. As the webchat creates/loads a conversation, the page POSTs the
   `conversationId` back to `/api/conversation` so the next device that
   logs in with the same username also resumes the same conversation.

## Prerequisites

- Node.js ≥ 18
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
| `POST` | `/api/login`        | Body `{ username }`. Sets cookie. Returns `userKey` (= username). |
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
└── .data/users.json       # username → { conversationId } (gitignored)
```

## Caveats

This is intentionally minimal:

- **No password.** The `userKey` is just the username, so anyone who knows a
  username can resume that session. For real auth, use an unguessable,
  server-issued `userKey` instead of the plain username.
- **`conversationId` sync** only happens on the webchat's `conversation`
  event. Messages don't re-sync the id; if you want belt-and-suspenders,
  also POST from the `message` handler with a small debounce.
- **No server-side Botpress calls.** User creation/association is delegated
  entirely to the webchat via `updateUser({ userKey })`. If you need
  deterministic server-managed users (or to rotate keys), pre-create them with
  `POST /:clientId/users` + `x-admin-secret` and pass the returned key instead.

## License

MIT
