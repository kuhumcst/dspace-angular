# CLARIN-DK Frontend Customization Guide

This document maps how the DSpace Angular frontend is composed, identifies the
Czech/LINDAT-specific parts inherited from the upstream `ufal/dspace-angular` fork,
and tracks what has already been adapted for `dspace.clarin.dk`.

---

## Theme and Component Override System

Components resolve in a three-tier cascade at runtime:

```
src/themes/custom/   →  src/themes/dspace/   →  src/app/   (base)
   (highest priority)                            (fallback)
```

Each themed component uses a `ThemedComponent<T>` wrapper (e.g.
`themed-footer.component.ts`) that dynamically imports the component from the
highest-priority theme directory that provides it. If a theme doesn't have an
override, the next tier is tried, falling back to the base `src/app/` version.

The three CSS bundles (`base-theme`, `dspace-theme`, `custom-theme`) load in that
order; later bundles override earlier ones via normal CSS cascade.

**Note:** `src/themes/eager-themes.module.ts` currently has the custom eager theme
module commented out. This means custom-theme components lazy-load on first access
rather than being pre-loaded, which can cause a brief flicker. Consider uncommenting
when the custom theme is stable.

---

## How Templates and Translations Work Together

There are **no per-language template variants** anywhere in the codebase. The entire
app uses a single set of templates. Translatable strings use the `| translate` pipe
(e.g. `{{'navbar.repository' | translate}}`); everything else is hardcoded directly
into the template HTML. This means two distinct and independent kinds of work when
adapting for a new institution or language:

- **Translation file work** — editing `.json5` files. Affects all the generic DSpace
  surfaces: forms, labels, menus, search, item pages, admin panels, and the
  `clarin-*` modules. No code changes needed; the pipe does the rest.
- **Template/component work** — editing `.html` and `.ts` files. Required for
  anything hardcoded: branding, institution links, images, routing logic. This is
  independent of translation files.

### Translation file layers

Translation files resolve in two layers, matching the theme cascade:

1. **Base catalogue:** `src/assets/i18n/{lang}.json5` — the full set of keys
   (~6,200 for English). This is what upstream DSpace ships and what most components
   pull from.
2. **Theme override:** `src/themes/custom/assets/i18n/{lang}.json5` — merged on top
   at runtime. Currently contains only 2 keys for English (`menu.section.browse_global`
   and `repository.title.prefix`). Any key present here wins over the base catalogue.

Both layers need a file for each active language. See
[i18n / Language Configuration](#i18n--language-configuration) for current status.

### Language-specific static HTML pages

A small set of pages (about, license terms) are served as pre-rendered static HTML
rather than Angular components. These live in `src/static-files/`, with a
language-specific subdirectory for each non-default locale:

```
src/static-files/          ← English defaults
src/static-files/cs/       ← Czech overrides (about.html, license-*.html)
```

`HtmlContentService.getHtmlContentByPathAndLocale()` selects the right file based
on the active language, falling back to the English default. If Danish static pages
are needed in future, a `src/static-files/da/` directory following the same pattern
is the mechanism.

---

## Component Map

Each entry notes what is controlled by translation keys and what is hardcoded, so
it is clear whether a given change needs a `.json5` edit, a template edit, or both.

### Navigation / Header

| File | What it is | i18n'd | Hardcoded | Status |
|------|-----------|--------|-----------|--------|
| `src/themes/dspace/app/header/header.component.html` | Main top nav bar | Nav labels (`navbar.*` keys) | LINDAT/DARIAH logo images and URLs; `getLangCodeIfCzech()` URL routing; partner link hrefs | **Needs replacement** |
| `src/themes/dspace/app/navbar/navbar.component.html` | Secondary nav bar | Logo alt text, nav description | `clarin.eu` logo link href; menu items come from app config (not hardcoded, not i18n) | Mostly generic; review |
| `src/app/clarin-navbar-top/` | Language switcher + login/logout | `language.*`, `login.title`, `logout.title` | Icon file paths (`en.png`, `cs.png`); `setLanguage('cs')` call | **Needs update** (swap cs→da) |

**Header TypeScript** (`src/app/header/header.component.ts`) contains two functions
that are dead code once the header template is rewritten:

- `getLangCodeIfCzech()` — returns `'cs'` or empty string, used to build LINDAT URLs
  like `/cs/#education`.
- `translateSlug()` — maps English nav slugs to Czech equivalents (`partners` →
  `cs/partneri`).

Both exist solely to serve the current LINDAT nav links. Remove them when the header
is replaced. See [Czech/LINDAT Remnants](#czechlindat-remnants-to-clean-up).

### Footer

| File | What it is | i18n'd | Hardcoded | Status |
|------|-----------|--------|-----------|--------|
| `src/app/footer/footer.component.html` | Full footer | Nothing — zero translation keys | Everything: LINDAT/CLARIAH-CZ headings, Czech partner names and URLs, ÚFAL copyright, helpdesk email | **Needs replacement** |

The footer is entirely institution-specific static HTML. When replacing it for
CLARIN-DK, consider whether to use `| translate` keys for the text content
(future-proofs it for Danish when that work happens) or keep it as static HTML if
the content is unlikely to vary by language.

### Home Page

| File | What it is | i18n'd | Hardcoded | Status |
|------|-----------|--------|-----------|--------|
| `src/app/home-page/home-page.component.html` | Hero section and page layout | Carousel text and section headings (`home-page.*` keys) | Logo images (`lindat-logo-new-sm.png`, `clarin-logo.png`); banner (`lindat_color_line.png`); logo link hrefs (`/lindat`, `clarin.eu`) | **Needs replacement** |

### AAI / Shibboleth

| File | What it is | Status |
|------|-----------|--------|
| `src/aai/aai.js` | DiscoJuice IdP discovery config. Contains LINDAT entity-ID logic (`host.match("lindat.mff.cuni.cz")`), but already includes KU (`id.ku.dk`) as a Danish IdP. | Partially adapted; review entity-ID logic |
| `src/aai/aai_config.js` | Service name and Shibboleth target. Service name already set to `"CLARIN-DK Repository"`. | Mostly done |
| `src/aai/discojuice/discojuice.js` | Minified DiscoJuice UI library | No changes needed |

### CLARIN-Specific Modules (`src/app/clarin-*`)

Generic CLARIN infrastructure: license management, bitstream authorization,
citation, Matomo analytics, etc. These are **fully i18n-aware** — all user-facing
strings use translation keys, and TypeScript code uses `TranslateService` for dynamic
messages (notifications, errors). They will work in Danish automatically once
`da.json5` exists. No template changes needed.

One exception: `clarin-license-info.component.html` contains an `isCsLocale()` check
that switches CSS layout classes. See
[Czech/LINDAT Remnants](#czechlindat-remnants-to-clean-up).

---

## Czech/LINDAT Remnants to Clean Up

A small number of Czech- or LINDAT-specific items remain in the codebase, grouped
here by how they should be handled.

### Dead with header rewrite

These exist solely to serve the current LINDAT navigation links. They disappear when
the header template is replaced — no separate cleanup task needed.

- `getLangCodeIfCzech()` in `src/app/header/header.component.ts`
- `translateSlug()` in the same file
- The LINDAT-specific hrefs in `src/themes/dspace/app/header/header.component.html`

### Needs investigation before removal

- **`isCsLocale()` in `src/app/item-page/clarin-license-info/clarin-license-info.component.ts`** —
  toggles `d-inline-flex` on the divs wrapping a license label. This may be a genuine
  layout fix for how long translated strings wrap rather than anything Czech-specific.
  Check whether the layout issue reproduces in other languages before removing the
  check.

### Inert, no action needed now

- `src/static-files/cs/` — Czech versions of license and about pages. Inert while
  Czech is disabled in prod config. Leave in place; if Danish static pages are needed
  later, add a `src/static-files/da/` directory following the same pattern.

---

## i18n / Language Configuration

The language list is defined in `src/config/default-app-config.ts` (all 25 languages
active by default) and **overridden at runtime** by `docker/config.prod.yml`, which
currently activates only English:

```yaml
languages:
  - code: en
    label: English
    active: true
  - code: da
    label: Dansk
    active: false   # see below
  - code: cs
    label: Ceština
    active: false
```

Danish (`da`) is kept in the language list but set to `active: false` because
`da.json5` does not yet exist. Activating it without the file causes a hard
`JSON.parse` error at runtime: the translation loader fetches the asset URL, gets a
404 HTML page back, and fails to parse it. There is no Danish translation available
upstream — it is not shipped by DSpace 7 and no community translation effort for
Danish exists.

When the time comes to add Danish support, the steps are:

1. Copy `en.json5` → `da.json5` as a baseline in both `src/assets/i18n/` and
   `src/themes/custom/assets/i18n/`.
2. Translate the keys in `da.json5`. English values serve as a readable fallback for
   any keys not yet translated.
3. Set `da` to `active: true` in `docker/config.prod.yml`.

---

## Production Config (`docker/config.prod.yml`)

Already configured for CLARIN-DK:
- Host/URLs point to `dspace.clarin.dk`
- SSL on port 443
- REST namespace `/server`
- Czech and Danish both disabled; English is the sole active language until
  `da.json5` is created (see i18n section above)

---

## What's Done / What's Left

| Area | Done | TODO |
|------|------|------|
| Production URLs & ports | ✓ | |
| Language config (disable cs) | ✓ | |
| AAI service name | ✓ | |
| Danish IdP in DiscoJuice | ✓ | |
| Auth plugin sequence (`local.cfg`) | ✓ | |
| Header / top nav | | Replace template; `getLangCodeIfCzech()` + `translateSlug()` go with it |
| Footer | | Replace with CLARIN-DK content; consider adding i18n keys |
| Home page hero | | Replace logos, banner, and link hrefs |
| Language switcher | | Swap `cs.png` → `da.png`; update `setLanguage()` call |
| AAI entity-ID fallback logic | | Remove/update `lindat.mff.cuni.cz` check in `aai.js` |
| `isCsLocale()` layout check | | Investigate in `clarin-license-info` before removing |
| Danish translations (`da.json5`) | | Create file, translate, set `da` active — see i18n section |
| Danish static pages | | Create `static-files/da/` if any static pages are needed in Danish |
| Eager theme module | | Uncomment custom theme in `eager-themes.module.ts` when stable |
