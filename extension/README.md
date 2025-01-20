# uOttawa Tools Extension

The source code for the Chrome extension.

## Building

This project is built using pnpm. With [Node.js](https://nodejs.org/en/download) installed, run:

```sh
corepack enable
corepack install
```

in the project root to get set up. Then, build with:

```sh
pnpm run build
```

The chrome extension will be generated in the `dist/` directory.
With developer mode enabled for Chrome extensions, you can enable this extension
by clicking "Load unpacked" and then selecting the `dist/` folder.

## Setting up Google OAuth2

This project requires a valid OAuth2 Client ID for the Google Calendar sync feature.
The backend is not used for authentication--tokens are stored entirely clientside.

You will need to generate a Chrome Extension API key from the Google Cloud Console.
Make sure that it has the following scopes:

- `https://www.googleapis.com/auth/calendar.events.owned`
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`

Then, update `public/manifest.json` with your API key.
Test if it works by opening the extension popup and clicking "Enable Google Calendar Sync."
