# webchat-continuity-demo

Une petite application Node/Express qui démontre la **continuité d'utilisateur entre appareils**
pour [Botpress Webchat](https://botpress.com/docs/webchat). Connectez-vous avec un
nom d'utilisateur depuis n'importe quel navigateur ou appareil et reprenez le même utilisateur
Botpress — ainsi que le même historique de conversation — que vous aviez auparavant.

Le dépôt inclut aussi une variante **statique** (sans backend) qui explore
la façon dont le webchat persiste l'identité dans le `localStorage`.

## Fonctionnement

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
│         │ writes to localStorage:
│         │   bp-webchat-<clientId>-client
│         │   = { state: { user: { userId, userToken }, conversationId },
│         │       version: 0 }
│         │
│         │ loads https://cdn.botpress.cloud/webchat/v3.6/inject.js
│         │ → window.botpress.init({ clientId })
│         │ → webchat picks up the seeded identity from localStorage
└─────────┘
```

1. Le navigateur envoie un `username` en POST vers `/api/login`.
2. Le serveur Node cherche le nom d'utilisateur dans `.data/users.json`. S'il est
   inconnu, il appelle `POST https://webchat.botpress.cloud/<clientId>/users` pour
   créer un utilisateur Botpress et met en cache les valeurs `{ userId, userKey }` retournées.
3. Le serveur dépose un cookie `username` et retourne
   `{ userId, userKey, conversationId }` à la page.
4. La page écrit ces valeurs dans l'entrée `localStorage`
   `bp-webchat-<clientId>-client` du webchat (l'enveloppe de style Zustand
   que le webchat lit au démarrage) et charge le script `inject`.
5. À mesure que le webchat crée ou charge une conversation, la page renvoie le
   `conversationId` en POST vers `/api/conversation` afin que le prochain appareil
   qui se connecte avec le même nom d'utilisateur reprenne aussi la même conversation.

## Prérequis

- Node.js ≥ 18 (utilise `fetch` natif)
- Un `clientId` de Botpress Webchat
  (Botpress Cloud → Webchat → Advanced → Configuration → clientId)

## Démarrage

```bash
npm install
CLIENT_ID=<your-client-id> npm start
# → http://localhost:8000
```

Variables d'environnement optionnelles :

| Var               | Défaut                              | Rôle                                            |
|-------------------|-------------------------------------|-------------------------------------------------|
| `CLIENT_ID`       | _(requis)_                          | clientId du Webchat                             |
| `PORT`            | `8000`                              | Port du serveur local                           |
| `WEBCHAT_API_URL` | `https://webchat.botpress.cloud`    | Surcharge de la base Chat API non par défaut    |

## Tester la continuité entre appareils

1. Ouvrez `http://localhost:8000` dans le navigateur A, connectez-vous en tant que `alice`, envoyez un message.
2. Ouvrez la même URL dans le navigateur B (autre profil, navigation privée, ou un autre
   appareil sur votre réseau local — remplacez `localhost` par l'adresse IP de votre machine).
3. Connectez-vous de nouveau en tant que `alice`. Même utilisateur Botpress, même historique de conversation.

Pour changer d'identité, cliquez sur **Log out** — cela efface le cookie et toutes les
entrées `localStorage` `bp-webchat-*`.

## API

| Méthode | Chemin              | Description                                                   |
|---------|---------------------|---------------------------------------------------------------|
| `GET`   | `/api/config`       | Retourne `{ clientId }`                                       |
| `GET`   | `/api/me`           | Retourne le `{ user }` courant depuis le cookie, ou `null`   |
| `POST`  | `/api/login`        | Corps `{ username }`. Assure l'utilisateur Botpress. Dépose le cookie. |
| `POST`  | `/api/logout`       | Efface le cookie                                              |
| `POST`  | `/api/conversation` | Corps `{ conversationId }`. Persiste l'id de conversation courant |

## Fichiers

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

## Limitations

Cette démo est volontairement minimale :

- **Aucun mot de passe.** Quiconque connaît un nom d'utilisateur peut reprendre cette session.
- **Aucun rafraîchissement du `userKey`.** Le JWT est mis en cache indéfiniment dans `.data/users.json`.
  Lorsqu'il finit par expirer, la solution la plus simple est de supprimer l'entrée et
  de se reconnecter (ce qui crée un nouvel utilisateur Botpress) — ou d'étendre le serveur
  pour appeler `generateUserKey` (nécessite un admin secret).
- **La synchronisation du `conversationId`** ne se fait que sur l'événement `conversation`
  du webchat. Les messages ne re-synchronisent pas l'id ; pour plus de robustesse,
  envoyez aussi un POST depuis le handler `message` avec un petit debounce.
- **`x-admin-secret`** n'est pas utilisé. Avec lui, vous pouvez pré-créer des utilisateurs avec
  des IDs déterministes et faire la rotation des user keys côté serveur.

## Licence

MIT
