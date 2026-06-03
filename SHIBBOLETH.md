# Shibboleth / CLARIN Discovery Service Login — CLARIN-DK

This documents the login flow and fixes applied when wiring up federated
Shibboleth login on the CLARIN-DK fork.

## Login flow

The login flow uses the [CLARIN Discovery Service](https://discovery.clarin.eu/)
rather than an inline IdP picker.  When the user clicks the login button,
`ClarinNavbarTopComponent.redirectToDiscovery()` builds a redirect URL and
sends the browser to:

```
https://discovery.clarin.eu/?entityID=<SP_ENTITY_ID>&return=<SHIBBOLETH_SSO_URL>
```

Where:
- `<SP_ENTITY_ID>` is derived from `window.location.origin + '/shibboleth'`
  (e.g. `https://repository.clarin.dk/shibboleth`)
- `<SHIBBOLETH_SSO_URL>` is
  `<origin>/Shibboleth.sso/Login?SAMLDS=1&target=<TARGET>`
- `<TARGET>` is `<repoPath>/authn/shibboleth?redirectUrl=<currentPage>`

After the user picks an IdP, the discovery service appends `&entityID=<IDP>`
to the return URL and redirects back to Shibboleth, which completes the SAML
exchange and lands the user on the page they came from.

The SP entity ID registered in the CLARIN federation is
`https://repository.clarin.dk/shibboleth` (see
`metadata/repository.clarin.dk%252Fshibboleth.xml` in the SPF-SPs-metadata
repo).  While the frontend is served from `repository.clarin.dk`, Shibboleth
accepts both hostnames; the entity ID will automatically match once the
frontend moves to `repository.clarin.dk`.

---

## Removal of DiscoJuice

The previous implementation used LINDAT's DiscoJuice/AAI pattern: three static
JS files (`discojuice.js` → `aai.js` → `aai_config.js`) loaded at runtime by
`ClarinNavbarTopComponent`, which rendered an inline IdP-picker popup.

This was replaced by a redirect to `discovery.clarin.eu`.  The following
changes were made:

| File | Change |
|------|--------|
| `src/app/clarin-navbar-top/clarin-navbar-top.component.ts` | Removed `ScriptLoaderService`, `AfterViewInit`, and all script-loading logic; added `redirectToDiscovery()` |
| `src/app/clarin-navbar-top/clarin-navbar-top.component.html` | Login link changed from a DiscoJuice hook (`id="clarin-signon-discojuice" class="signon"`) to `(click)="redirectToDiscovery()"` |
| `src/app/clarin-navbar-top/script-loader-service.ts` | Deleted (only served DiscoJuice/AAI script loading) |
| `src/app/shared/log-in/methods/password/log-in-password.component.ts` | Removed `toggleDiscojuiceLogin()`, `popUpDiscoJuiceLogin()`, `initializeDiscoJuiceCache()`, and the `SHOW_DISCOJUICE_POPUP_CACHE_NAME` constant |
| `angular.json` | Removed `src/aai/discojuice/discojuice.css` from the `styles` array |
| `webpack/webpack.common.ts` | Removed asset-copy entries for `aai.js`, `aai_config.js`, and `discojuice.js` |
| `src/app/app.module.ts` | Removed `ScriptLoaderService` provider |
| `src/aai/` | Entire directory deleted (`aai.js`, `aai_config.js`, `discojuice/`) |
| `src/static-files/disco-juice.html` | Deleted (DiscoJuice response-receiver iframe) |

---

## Fixes applied

### 1. Nginx — header passing to backend

`shib_request_set $var $upstream_http_variable_*` does **not** work: the
`$upstream_http_*` variables are not populated in the subrequest context, so
`proxy_set_header` overwrote the correct headers with empty strings.

**Fix:** removed all `shib_request_set` / `proxy_set_header` lines.
`shib_request_use_headers on` alone is sufficient.

```nginx
location /server/api/authn/shibboleth {
    include includes/shib_clear_headers;
    more_clear_input_headers 'affiliation' 'cn' 'entitlement' 'eppn'
        'givenName' 'mail' 'persistent-id' 'sn' 'Shib-Identity-Provider';

    shib_request /shibauthorizer;
    shib_request_use_headers on;

    include proxy_params;
    proxy_pass http://dspace7-backend;
}
```

### 2. EPerson netid mismatch

CLARIN's proxy IdP re-scopes identities: `user@university.edu` becomes
`user_university.edu@clarin.eu` and the IdP becomes `https://idm.clarin.eu`.
The netid stored in the `eperson` table must match this re-scoped form:

```
user_university.edu@clarin.eu[https://idm.clarin.eu]
```

### 3. `repositoryPath` trailing slash

`HALEndpointService.getRootHref()` does not guarantee a trailing slash.
Concatenating `'authn/shibboleth'` directly produced `…/server/apiauthn/…`.

**Fix:** in `redirectToDiscovery()`, normalise before concatenation:

```typescript
const repoPath = this.repositoryPath.endsWith('/')
  ? this.repositoryPath
  : this.repositoryPath + '/';
```

---

## Gotchas

- **CLARIN re-scopes eppn.**  Always use `idm.clarin.eu` as the IdP in
  tests; direct university IdPs produce a different identity.
- **`docker compose build` exits 0 even on failure.**  After a frontend
  rebuild, verify the new code landed with
  `docker exec dspace-angular1 grep -rl "discovery.clarin.eu" /app/dist/browser/`
  before concluding the deploy succeeded.
- **`docker compose up -d` will not recreate a running container** even if
  the image changed.  Always pass `--force-recreate` when redeploying after
  a rebuild.
