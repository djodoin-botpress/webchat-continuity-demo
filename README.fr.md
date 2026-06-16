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
│ Browser │ ───────────────────────▶  │ Node    │  (aucun appel Botpress —
│         │   { username }            │ server  │   juste cookie + store conv)
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

1. Le navigateur envoie un `username` en POST vers `/api/login`.
2. Le serveur Node enregistre le nom d'utilisateur dans `.data/users.json` (uniquement
   pour mémoriser son `conversationId`) et dépose un cookie `username`. Il ne fait
   **aucun** appel à Botpress — c'est le webchat qui associe l'utilisateur lui-même.
3. Le serveur retourne `{ username, userKey, conversationId }`, où
   `userKey === username`.
4. La page charge le script `inject` et appelle
   `window.botpress.init({ clientId })`. Dès que l'événement `webchat:initialized`
   se déclenche, elle associe l'identité via l'API publique supportée :
   `window.botpress.updateUser({ userKey })`. Le webchat associe (ou crée à la
   volée) l'utilisateur Botpress identifié par ce `userKey` et persiste lui-même
   son enveloppe `localStorage` `bp-webchat-<clientId>-client`.
5. À mesure que le webchat crée ou charge une conversation, la page renvoie le
   `conversationId` en POST vers `/api/conversation` afin que le prochain appareil
   qui se connecte avec le même nom d'utilisateur reprenne aussi la même conversation.

## Prérequis

- Node.js ≥ 18
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
| `POST`  | `/api/login`        | Corps `{ username }`. Dépose le cookie. Retourne `userKey` (= username). |
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
└── .data/users.json       # username → { conversationId } (gitignored)
```

## Limitations

Cette démo est volontairement minimale :

- **Aucun mot de passe.** Le `userKey` est simplement le nom d'utilisateur ; quiconque
  connaît un nom d'utilisateur peut donc reprendre cette session. Pour une vraie
  authentification, utilise un `userKey` non devinable, émis par le serveur, plutôt que
  le nom d'utilisateur en clair.
- **La synchronisation du `conversationId`** ne se fait que sur l'événement `conversation`
  du webchat. Les messages ne re-synchronisent pas l'id ; pour plus de robustesse,
  envoyez aussi un POST depuis le handler `message` avec un petit debounce.
- **Aucun appel Botpress côté serveur.** La création/association de l'utilisateur est
  entièrement déléguée au webchat via `updateUser({ userKey })`. Si tu as besoin
  d'utilisateurs déterministes gérés côté serveur (ou de faire la rotation des clés),
  pré-crée-les avec `POST /:clientId/users` + `x-admin-secret` et passe la clé retournée.

## Licence

MIT
