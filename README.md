# weegloo-service-user

Vanilla-JavaScript browser SDK for **Weegloo ServiceLogin** - the per-Space, app-managed member sign-in feature of [Weegloo](https://weegloo.com). Zero runtime dependencies. Ships UMD, ESM, and minified builds.

- Drives the full OAuth 2.0 flow — **Google, GitHub, Facebook, GitLab, LINE, Kakao, and Naver** — redirect → callback → token exchange → refresh → logout.
- Stores tokens in `sessionStorage` (or `localStorage`, or a custom adapter).
- Auto-refreshes the `accessToken` before it expires.
- Removes `exchangeToken` from the address bar **before** the network call (success, failure, or reload - never leaks).
- Auto-injects `Authorization: Bearer …` for ACMA / ACDA calls.

> The Bearer Token issued by ServiceLogin is valid **only** against `acma.weegloo.com` / `acda.weegloo.com`. It is **not** valid against `cma.weegloo.com` / `cda.weegloo.com`.

---

## Install

### Option A. npm + bundler (Vite, Webpack, Next.js, …)

```bash
npm install weegloo-service-user
```
```js
import WeeglooServiceLogin from 'weegloo-service-user';

const auth = WeeglooServiceLogin.init({ spaceId: 'YOUR_SPACE_ID' });
```

### Option B. `<script>` tag (static sites, Weegloo WebHosting)

After publishing, jsDelivr and unpkg serve the same file automatically:

```html
<!-- Latest patch of the major version (auto-updates within v1.x) -->
<script src="https://cdn.jsdelivr.net/npm/weegloo-service-user@1/dist/service-login.min.js"></script>
<!-- or -->
<script src="https://unpkg.com/weegloo-service-user@1/dist/service-login.min.js"></script>
<script>
  const auth = WeeglooServiceLogin.init({ spaceId: 'YOUR_SPACE_ID' });
</script>
```

The library exposes a global `WeeglooServiceLogin` when loaded via `<script>`.

#### Pinning to an immutable revision

Each release also ships content-addressed copies whose bytes never change for a given hash, suitable for `integrity="sha384-…"` pinning and aggressive CDN caching. Pick the build you want and append `.<hash>` before the file extension:

```html
<script
  src="https://cdn.jsdelivr.net/npm/weegloo-service-user@1.0.0/dist/service-login.<hash>.min.js"
  integrity="sha384-…"
  crossorigin="anonymous"></script>
```

The exact hash and SRI value for the version you installed are recorded in `dist/manifest.json` (`require('weegloo-service-user/manifest')` from Node, or the same path on jsDelivr).

---

## Minimal example

```html
<button id="login">Login</button>
<button id="logout">Logout</button>
<button id="load">Load via ACDA</button>

<script src="https://cdn.jsdelivr.net/npm/weegloo-service-user@1/dist/service-login.min.js"></script>
<script>
  const SPACE_ID = 'YOUR_SPACE_ID';
  const auth = WeeglooServiceLogin.init({ spaceId: SPACE_ID });

  // On the callback page, complete the OAuth handshake.
  if (location.search.includes('exchangeToken=')) {
    auth.handleCallback().catch(console.error);
  }

  document.querySelector('#login').onclick  = () => auth.login();
  document.querySelector('#logout').onclick = () => auth.logout();
  document.querySelector('#load').onclick   = async () => {
    const res  = await auth.fetch(`https://acda.weegloo.com/v1/spaces/${SPACE_ID}/contents`);
    console.log(await res.json());
  };
</script>
```

---

## Choosing a provider

ServiceLogin supports these OAuth providers: **`google`**, **`github`**, **`facebook`**, **`gitlab`**, **`line`**, **`kakao`**, and **`naver`**. The provider is just a path segment in the login URL, so a single SDK instance can drive any of them — pick the default at `init()`, or choose per click via `login({ provider })`:

```html
<button data-provider="google">Continue with Google</button>
<button data-provider="github">Continue with GitHub</button>
<button data-provider="facebook">Continue with Facebook</button>
<button data-provider="gitlab">Continue with GitLab</button>
<button data-provider="line">Continue with LINE</button>
<button data-provider="kakao">Continue with Kakao</button>
<button data-provider="naver">Continue with Naver</button>

<script>
  const auth = WeeglooServiceLogin.init({ spaceId: 'YOUR_SPACE_ID' }); // default 'google'

  document.querySelectorAll('[data-provider]').forEach((btn) => {
    btn.onclick = () => auth.login({ provider: btn.dataset.provider });
  });
</script>
```

> A provider only works if it has been enabled for the Space: each provider must be added to the `ServiceLogin` resource (with its `clientId` / `clientSecret`) in the Weegloo Console, and its redirect URI registered with the provider — see the setup checklist below. Passing a `provider` that the Space has not configured will fail at the auth server.

The callback handling, token exchange, refresh, and logout are identical across providers — `handleCallback()` does not need to know which provider was used.

---

## API

### `WeeglooServiceLogin.init(options) → instance`

| Option | Type | Default | Description |
|---|---|---|---|
| `spaceId` | `string` | - (**required**) | Your Weegloo Space ID. |
| `provider` | `string` | `'google'` | Default OAuth provider. One of `'google'`, `'github'`, `'facebook'`, `'gitlab'`, `'line'`, `'kakao'`, `'naver'`. Can be overridden per call via `login({ provider })`. |
| `authBaseUrl` | `string` | `'https://auth.weegloo.com'` | Base URL of the auth server. |
| `storage` | `'session' \| 'local' \| object` | `'session'` | Token storage. The `'session'` default uses `sessionStorage` and is the recommended security posture. A custom adapter `{ getItem, setItem, removeItem }` is also accepted. |
| `storageKey` | `string` | `weegloo:serviceLogin:<spaceId>` | Key used in storage. |
| `autoRefresh` | `boolean` | `true` | If `true`, `getAccessToken()` will refresh automatically when the access token is near expiry. |
| `refreshLeewaySeconds` | `number` | `60` | Refresh fires `N` seconds before `expiresAt`. |

Calling `init()` multiple times with the same `spaceId | authBaseUrl` pair returns the same cached instance.

### Instance methods

| Method | Returns | Description |
|---|---|---|
| `login(opts?)` | `void` | Redirects the browser to the OAuth login page. Pass `{ provider }` (`'google' \| 'github' \| 'facebook' \| 'gitlab' \| 'line' \| 'kakao' \| 'naver'`) to override the default for this call, and `{ returnTo }` to stash a value readable after `handleCallback()` via `consumeReturnTo()`. |
| `handleCallback(opts?)` | `Promise<tokens>` | Call on the callback page. **First** strips `exchangeToken` from the address bar, **then** exchanges it for tokens and stores them. |
| `isLoggedIn()` | `boolean` | `true` if `accessToken` is unexpired *or* a valid `refreshToken` exists. |
| `getAccessToken()` | `Promise<string \| null>` | Returns the access token, auto-refreshing if necessary. Returns `null` if the user is not logged in or refresh failed. |
| `getTokens()` | `tokens \| null` | Returns the stored token bundle. |
| `refresh()` | `Promise<tokens>` | Forces a refresh (`POST /oauth/refresh`). |
| `logout()` | `Promise<true>` | Calls `DELETE /oauth/token` with the stored `refreshToken` and clears local storage. |
| `fetch(input, init?)` | `Promise<Response>` | A `fetch` wrapper that injects `Authorization: Bearer <accessToken>` and avoids forcing `Accept: application/json` (Weegloo serves a vendor media type). |
| `onChange(cb)` | `() => void` | Subscribe to lifecycle events: `'login' \| 'refresh' \| 'logout' \| 'set' \| 'clear' \| 'refresh-failed'`. Returns an unsubscribe function. |

---

## Security notes

- **`exchangeToken` is removed from the URL before any network request.** Even if the token-exchange call fails, hangs, or the user reloads mid-flight, the token never lingers in `window.location`, the session-history stack, or outgoing `Referer` headers.
- The default `sessionStorage` discards tokens when the tab closes. Use `storage: 'local'` only when persistent sign-in is a deliberate UX choice.
- The Bearer Token authorizes **ACMA** and **ACDA** only. Do not send it to CMA, CDA, or Upload - the server will reject it.
- The library never sets `Accept: application/json` on its outgoing requests because Weegloo APIs negotiate the vendor media type `application/vnd.com.weegloo.v1+json`.

---

## What is ServiceLogin?

ServiceLogin is the **per-Space, app-managed member directory** of a Weegloo Space. It is *separate* from Weegloo Console accounts (which manage the Space itself). Use it to add member sign-up / sign-in to a product you ship on top of a Weegloo Space - for example, a members-only board, a paid-content portal, or any community where readers must sign in.

### Resource model

- **`ServiceLogin`** - the Space's per-product login configuration (enabled OAuth providers, callback URL, default role).
- **`ServiceUserRole`** - the permission rule set assigned to app-managed members. Defines what they may read or write through ACMA / ACDA.
- **`ServiceUser`** - one record per app-managed member. May carry an optional `roleOverride` (a different `ServiceUserRole` for that specific member) and an optional `isAdmin: true` (adds *delete* of other members' resources, scoped to the role's permissions).

A successful sign-in returns a Bearer Token tied to the corresponding `ServiceUser`. That token authorizes **ACMA** and **ACDA** only.

---

## Setup checklist (one-time)

Repeat **step 1** for every provider you want to enable (`google`, `github`, `facebook`, `gitlab`, `line`, `kakao`, `naver`); they are independent and can be turned on individually.

### 1. Register an OAuth client with each provider

In the provider's developer console, create an OAuth app and register Weegloo's redirect URI:

`https://auth.weegloo.com/v1/spaces/{spaceId}/login/oauth2/code/{provider}`

where `{spaceId}` is the Weegloo Space ID hosting the ServiceLogin and `{provider}` is one of `google`, `github`, `facebook`, `gitlab`, `line`, `kakao`, `naver`.

| Provider | `provider` value | Where to register | Redirect URI field |
|---|---|---|---|
| Google | `google` | Google Cloud Console → "Google Auth Platform" → OAuth Client | **Authorized redirect URIs** |
| GitHub | `github` | GitHub → Settings → Developer settings → OAuth Apps | **Authorization callback URL** |
| Facebook | `facebook` | Meta for Developers → your App → Facebook Login → Settings | **Valid OAuth Redirect URIs** |
| GitLab | `gitlab` | GitLab → your avatar (profile photo, top-right) → Edit profile → Access > Applications → Add new application (or a group's / the Admin area's Applications) | **Redirect URI** |
| LINE | `line` | LINE Developers Console → your Provider → create a **LINE Login** channel → LINE Login tab | **Callback URL** |
| Kakao | `kakao` | Kakao Developers → My Application → App → Platform key → REST API key | **Redirect URI** |
| Naver | `naver` | Naver Developers → Application → Register application → select "네이버 로그인" (Naver Login) | **Callback URL** |

> Note: the `/login/oauth2/code/{provider}` path is the **redirect URI** that the provider calls Weegloo at — it is *different* from the URL the SDK navigates the browser to (`/login/oauth2/{provider}`, no `code` segment). This redirect URI is deploy-independent: it always points at `auth.weegloo.com`, so you can register it before your own app is deployed.

Provider-specific gotchas when filling in step 2's `clientId` / `clientSecret`:

- **GitLab** — `clientId` is the **Application ID**, `clientSecret` is the **Secret** (shown once at creation).
- **LINE** — the channel must be a **LINE Login** channel of App type **Web app**; `clientId` is the **Channel ID**, `clientSecret` is the **Channel secret**. Publish the channel (out of "Developing") so users beyond admins/testers can sign in.
- **Kakao** — activate Kakao Login first (Kakao Login → set Status **ON**); `clientId` is the **REST API key**, `clientSecret` is the **Client secret** (enabled by default on newer keys — leave it on and supply it).
- **Naver** — `clientId` / `clientSecret` are the **Client ID** / **Client Secret** issued when you register the app. A new app starts in **development status**: only the developer account and registered **test members** can sign in until the app passes Naver's **review** and goes to production.

**Enable email — required for sign-up.** This product uses the member's email address at sign-up, and sign-in fails if the provider returns no email. **Weegloo already requests the necessary scopes** for each provider, so you don't configure scopes anywhere in Weegloo — your only job is to make sure the provider is allowed to release the email (and the profile fields). The scopes Weegloo requests, and what you must enable in each provider's console:

- **Google** — scopes `email`, `profile`. Nothing extra to enable — both are non-sensitive, so no Google verification is required.
- **GitHub** — scopes `read:user`, `user:email`. Nothing to enable (OAuth Apps have no scope settings); `user:email` means the email is returned even when the member keeps it private.
- **Facebook** — scopes `email`, `public_profile`. Give the `email` permission **Advanced access** under **App Review → Permissions and Features** (Business Verification is usually required); by default it only covers app roles/testers.
- **GitLab** — scope `read_user`. When creating the application, tick **`read_user`** — it grants read access to the account email.
- **LINE** — scopes `profile`, `email` (plus `openid`, injected automatically). Apply for **Email address permission** (Basic settings → OpenID Connect → Apply) and upload a screenshot of how you request and use the email; LINE returns the email in the **ID token**, not the profile response.
- **Kakao** — scopes `profile_nickname`, `profile_image`, `account_email`. Enable those consent items (Kakao Login → Consent Items). `account_email` is restricted: it needs a **Biz App** (business registration or identity verification) plus review — until approved it only works for the app's own team members.
- **Naver** — Naver ignores the OAuth scopes and uses the app's **제공 정보 (Provided info)** setting instead. Set **Email address**, **Nickname**, and **Profile image** to **Required (필수)** — items left **Optional (추가)** are never returned.

### 2. Configure ServiceLogin in the Weegloo Console

1. In the target Space, **create a `ServiceLogin`** record.
2. Add an entry to its `providers` array for each provider you enabled in step 1, with the `clientId` / `clientSecret` issued by that provider. The resource field that identifies the provider is `registrationId` — its value is the same provider string you pass to the SDK (`google` / `github` / `facebook` / `gitlab` / `line` / `kakao` / `naver`):
   ```json
   "providers": [
     { "registrationId": "google",   "clientId": "...", "clientSecret": "..." },
     { "registrationId": "github",   "clientId": "...", "clientSecret": "..." },
     { "registrationId": "facebook", "clientId": "...", "clientSecret": "..." },
     { "registrationId": "gitlab",   "clientId": "...", "clientSecret": "..." },
     { "registrationId": "line",     "clientId": "...", "clientSecret": "..." },
     { "registrationId": "kakao",    "clientId": "...", "clientSecret": "..." },
     { "registrationId": "naver",    "clientId": "...", "clientSecret": "..." }
   ]
   ```
3. Set `defaultRole` to a `Refer` of a `ServiceUserRole` you have created in advance with the appropriate permissions. Per-member overrides are possible later via `ServiceUser.roleOverride`.
4. Set `callbackUrl` to a URL on **your own product** that the SDK can intercept — Weegloo will redirect the browser there with `?exchangeToken=...` after a successful sign-in (any provider). The SDK's `handleCallback()` consumes this parameter to obtain a Bearer Token usable against ACMA / ACDA.

---

## OAuth flow (for reference)

The SDK encapsulates all of this; you only need to read it if you are debugging or porting the flow elsewhere.

1. Navigate the browser to:  
   `GET https://auth.weegloo.com/v1/spaces/{spaceId}/login/oauth2/{provider}`  
   where `{provider}` is `google`, `github`, `facebook`, `gitlab`, `line`, `kakao`, or `naver`. The user signs in through that provider.
2. Weegloo redirects the browser to the configured `callbackUrl` with `?exchangeToken=…` appended (the same `callbackUrl` for every provider).
3. Exchange the `exchangeToken` for tokens:  
   `POST https://auth.weegloo.com/v1/spaces/{spaceId}/oauth/token`  
   `Content-Type: application/json`  
   ```json
   { "exchangeToken": "abc" }
   ```
   Response:
   ```json
   {
     "accessToken": "XXXXXX",
     "tokenType": "Bearer",
     "scope": ["App"],
     "createdAt":  "2026-04-16T12:12:21.602Z",
     "expiresAt":  "2026-06-16T12:12:21.602Z",
     "refreshToken": "YYYYYYYY",
     "refreshExpiresAt": "2026-04-23T12:12:21.602Z"
   }
   ```
4. Send `Authorization: Bearer <accessToken>` to ACMA / ACDA.
5. Before `expiresAt`, refresh the access token:  
   `POST https://auth.weegloo.com/v1/spaces/{spaceId}/oauth/refresh`  
   ```json
   { "refreshToken": "YYYYYYYY" }
   ```
6. To sign out:  
   `DELETE https://auth.weegloo.com/v1/spaces/{spaceId}/oauth/token`  
   ```json
   { "refreshToken": "YYYYYYYY" }
   ```
   Sending the `refreshToken` is strongly recommended so the server can invalidate it - calling without a body is permitted but leaves the refresh token usable until natural expiry.

---

## Builds

Each build ships in two flavours: a **mutable "latest" alias** that auto-updates with patch releases, and a **content-addressed immutable revision** safe for SRI pinning.

| Format | Latest alias | Immutable revision | Use case |
|---|---|---|---|
| UMD | `dist/service-login.js` | `dist/service-login.<hash>.js` | `<script>` tag, CommonJS `require`, AMD |
| ES Module | `dist/service-login.esm.js` | `dist/service-login.<hash>.esm.js` | Modern bundlers, `import` |
| UMD (minified) | `dist/service-login.min.js` | `dist/service-login.<hash>.min.js` | Production `<script>` / CDN |

`dist/manifest.json` records each build's `<hash>` (sha256, first 8 hex chars), byte size, and the `sha384` SRI integrity string ready to drop into `<script integrity="…">`.

The single source of truth is `src/service-login.js`. Run `npm run build` to regenerate the `dist/` outputs from it.

## License

[MIT](./LICENSE)
