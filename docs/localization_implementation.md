# Localization (i18n) — Epic L: Story L1

> **Status: PLANNED / DESIGN — not yet implemented.** The app currently has **no** localization: all
> UI strings are hardcoded English and there is no Settings screen or language switcher. The Flutter
> `.arb` setup and `test/l10n_test.dart` referenced in earlier drafts do **not** exist in this
> repository. The "Acceptance Criteria Fulfilled" checkmarks below describe the target state, not the
> current one.
>
> **Stack note:** The app is **Expo / React Native (TypeScript)**, not Flutter. The recommended i18n
> approach is `i18next` + `react-i18next` with `expo-localization` for device-locale detection (or a
> lightweight custom translation hook). See [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Overview

This document specifies internationalization (i18n) support, allowing users to switch between languages
as described in Epic L: Story L1.

## Proposed Implementation (React Native)

### Files to create/modify

1. **Dependencies**:
   - `i18next`, `react-i18next`, `expo-localization` (add to `package.json`)

2. **Localization resources**:
   - `lib/i18n/index.ts` — i18next init + device-locale detection + persisted override
   - `lib/i18n/locales/en.json` — English translations (default)
   - `lib/i18n/locales/es.json` — Spanish translations (example additional language)

3. **Screens to update**:
   - `app/_layout.tsx` — initialize i18n at app root (alongside the other providers)
   - `app/(tabs)/_layout.tsx` — translate tab labels (Home / Activity / Categories / Insights / Cards)
   - A new Settings screen — language selection UI (does not exist yet)

### Planned Initial Languages

- **English (en)** — default language
- **Spanish (es)** — example additional language

### User Interface (intended)

#### Language Selection (to build)

1. Open the (planned) **Settings** screen
2. Find the **Language** section
3. Tap to see available languages
4. Select the desired language
5. UI updates immediately (i18next re-render)

#### Strings to Localize (target)

- Tab labels (Home / Activity / Categories / Insights / Cards)
- Screen titles and headings
- Common UI elements (Save, Cancel, OK, etc.)
- Validation / error messages
- Notification titles (once notifications are added)

## Technical Details

### Adding New Languages

To add a new language:

1. Create a new resource file: `lib/i18n/locales/[languageCode].json`
2. Copy the key structure from `en.json`
3. Translate all string values
4. Register the resource in `lib/i18n/index.ts` and add it to the available-languages list used by the Settings screen

Example for French (`fr.json`):

```json
{
  "appTitle": "Poche Intelligente",
  "navigation": { "home": "Accueil" }
}
```

### Usage in Code

Use the `useTranslation` hook from `react-i18next`:

```tsx
import { useTranslation } from "react-i18next";

function Title() {
  const { t } = useTranslation();
  return <Text>{t("appTitle")}</Text>;
}
```

### Configuration

On startup, detect the device locale via `expo-localization`; use it if supported, otherwise fall back
to English. Persist a manual override (e.g. via `expo-secure-store`/`AsyncStorage`) so the user's choice
survives restarts.

## Testing

Add a Vitest suite (e.g. `tests/i18n.test.ts`) verifying:

- English and Spanish resources load correctly
- Language switching updates the active locale
- All supported locales expose the same set of keys (no missing translations)

## Acceptance Criteria (target — not yet met)

- [ ] User can switch language in Settings (Settings screen does not exist yet)
- [ ] UI strings change accordingly (strings are currently hardcoded)
- [ ] Language updates immediately on change
- [ ] Framework supports adding additional languages

## Future Enhancements

1. **Automatic Language Detection**: detect device language and set it on first launch
2. **More Languages**: add language packs based on user demand
3. **Pluralization**: i18next plural rules for different languages
4. **RTL Support**: right-to-left layout for Arabic, Hebrew, etc. (React Native `I18nManager`)

## Files Structure (proposed)

```
lib/
└── i18n/
    ├── index.ts             # i18next init + locale detection + persisted override
    └── locales/
        ├── en.json          # English translations (default)
        └── es.json          # Spanish translations

app/_layout.tsx              # Initialize i18n at app root
app/(tabs)/_layout.tsx       # Translated tab labels
```

This specification covers Epic L: Story L1 and provides the plan for internationalization in
SmartPocket. It is a design document — the feature is not yet built (see the status banner at the top).
