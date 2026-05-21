# Shibboleth / DiscoJuice Login — CLARIN-DK

This documents the bugs found and fixes applied when wiring up federated
Shibboleth login on the CLARIN-DK fork (`clarin-dk-shibboleth` branch).

The login flow here is **not** standard DSpace 7 Shibboleth auth.  It uses
LINDAT's DiscoJuice/AAI pattern: three static scripts loaded in order by
`ClarinNavbarTopComponent`:

```
discojuice.js  →  aai.js  →  aai_config.js
```

When the user clicks the login button, DiscoJuice opens an IdP-selection
popup.  After the user picks an IdP, the browser is redirected to:

```
/Shibboleth.sso/Login?SAMLDS=1&target=<TARGET>&entityID=<IDP>
```

`<TARGET>` must be `/server/api/authn/shibboleth?redirectUrl=<page>`.
Everything below is about making that URL correct.

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

### 3. `aai.js` — empty `target` in login URL

`targetUrl` was declared as `''` and passed into `DiscoJuice.Hosted.getConfig()`
before it was ever assigned, so the template URL always had `target=` empty.

**Fix:** initialise `targetUrl` from `opts.target` (with `redirectUrl` appended,
see §5) before the `getConfig()` call.

### 4. `aai.js` — `defaultCallback` never wired

`defaultCallback` was only set as `djc.callback` when `opts.localauth` was
truthy.  `aai_config.js` sets `localauth = ''` (CLARIN-DK is federated-only),
so the callback was never set.

**Fix:** added a fallback after the existing callback blocks:

```javascript
if (!djc.callback) {
  djc.callback = defaultCallback;
}
```

### 5. `aai.js` — `redirectUrl` missing from target

DiscoJuice Hosted uses the template URL (5th argument to `getConfig`)
directly for the login redirect — it does **not** invoke `djc.callback`.
The template URL therefore needs `redirectUrl` baked in at setup time.

**Fix:** changed the `targetUrl` initialisation to include it:

```javascript
targetUrl = opts.target + '?redirectUrl=' + window.encodeURIComponent(window.location.href);
```

### 6. `aai.js` — `namespace` leftover from LINDAT

`namespace` was hardcoded to `'repository'` (the LINDAT URL structure).
This broke flag image paths (`/repository/assets/images/flags/…`), the
post-SAML redirect base URL, and the login-page fallback redirect.

**Fix:** set `namespace = ''` (CLARIN-DK serves from root).

### 7. `aai_config.js` — Czech/LINDAT-specific code removed

- Removed the `ufal-point-dev` hostname check and the LINDAT themes
  `responseUrl` path; replaced with `/assets/disco-juice.html?`.
- Removed the local-auth login form HTML (Prague university accounts).
- Changed `serviceName` to `"CLARIN-DK Repository"`.

### 8. `discojuice.js` — IdP list and sorting

- Replaced the hardcoded Czech IdP (Prague) with KU (`id.ku.dk`) and
  CLARIN (`idm.clarin.eu`) in both the HTML template and the
  `selectProvider` fallback.
- The IdP list sort in `prepareData` is **ascending** (`return d-e`), so
  negative weights sort first.  CLARIN is at `-1000`, KU at `-999`.
- `discojuice.js` ships pre-compressed `.gz` and `.br` copies alongside
  the plain file.  Both must be regenerated after any edit (use Node's
  `zlib` — `brotli` CLI is not installed in the container):

```javascript
const fs = require('fs'), zlib = require('zlib');
const src = fs.readFileSync('/app/dist/browser/discojuice.js');
fs.writeFileSync('/app/dist/browser/discojuice.js.gz', zlib.gzipSync(src));
fs.writeFileSync('/app/dist/browser/discojuice.js.br', zlib.brotliCompressSync(src));
```

---

## Gotchas

- **CLARIN re-scopes eppn.**  Always use `idm.clarin.eu` as the IdP in
  tests; direct university IdPs produce a different identity.
- **`discojuice.js` needs `.gz`/`.br` regeneration** after edits;
  `aai.js` does not (nginx serves it uncompressed / on-the-fly).
- **DiscoJuice Hosted ignores `djc.callback`** for the actual login
  redirect — the template URL is what matters.  `djc.callback` is kept
  as a safety fallback only.
- **Weight sort is ascending** in DiscoJuice's `prepareData`.  Lower
  (more negative) weight = higher in the list.  `maxhits` defaults to 25.
