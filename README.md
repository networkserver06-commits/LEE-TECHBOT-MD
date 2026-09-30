# LEE TECH BOT

A production-oriented WhatsApp multi-device bot built with [Baileys](https://github.com/WhiskeySockets/Baileys). It provides group moderation, media utilities, status publishing, diagnostics, configurable access modes, and optional AI integrations.

> **Important:** This is an unofficial WhatsApp automation project. Use it responsibly and comply with WhatsApp’s terms, local laws, and the rules of the groups where it is used.

[![Repository](https://img.shields.io/badge/GitHub-LEE--TECHBOT--MD-181717?style=for-the-badge&logo=github)](https://github.com/networkserver06-commits/LEE-TECHBOT-MD)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

## Free deployment

Choose a persistent host, fork the repository, add your environment variables, and start the bot. Free-host limits, sleep policies, storage rules, and availability can change, so always check the provider’s current terms.

### Quick actions

| Action | Link |
|---|---|
| **Fork this repository** | [![Fork repository](https://img.shields.io/badge/FORK%20REPOSITORY-181717?style=for-the-badge&logo=github)](https://github.com/networkserver06-commits/LEE-TECHBOT-MD/fork) |
| **Download ZIP** | [![Download ZIP](https://img.shields.io/badge/DOWNLOAD%20ZIP-2ea44f?style=for-the-badge&logo=github)](https://github.com/networkserver06-commits/LEE-TECHBOT-MD/archive/refs/heads/main.zip) |
| **Get WhatsApp session** | [![Pairing site](https://img.shields.io/badge/PAIRING%20SITE-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://proper-badger-techlee-pair.koyeb.app/) |

### Free hosting options

| Platform | Start here | Recommended settings |
|---|---|---|
| **Katabump** | [![Deploy on Katabump](https://img.shields.io/badge/KATABUMP-5b21b6?style=for-the-badge&logo=server&logoColor=white)](https://rl.katabump.fr/2db624) | Node.js service, persistent storage, `npm start` |
| **Bot Hosting** | [![Deploy on Bot Hosting](https://img.shields.io/badge/BOT%20HOSTING-111827?style=for-the-badge&logo=server&logoColor=white)](https://bot-hosting.net/?aff=leetech254) | Node.js application, `npm ci`, `npm start` |

> **Free-host note:** WhatsApp bots need a continuously running process and persistent auth storage. If a free host sleeps, resets its filesystem, or stops long-running processes, the bot may disconnect or require a new session.

### Session and pairing

1. Open the [LEE TECH pairing site](https://proper-badger-techlee-pair.koyeb.app/).
2. Prefer **QR scan**. If using a pairing code, enter one fresh code immediately and do not request multiple codes for the same number.
3. Copy the complete `SESSION_BUNDLE=...` line sent to the linked WhatsApp account.
4. Add it to the host’s environment variables together with `AUTH_DIR=./auth`.
5. Deploy or restart the bot.

```env
BOT_MODE=private
PREFIX=.
AUTH_DIR=./auth
SESSION_BUNDLE=...paste-the-complete-value-here...
TIME_ZONE=Africa/Nairobi
```

Never share the session bundle, commit it to GitHub, or use the same auth directory in multiple bot processes.

## Highlights

- **Group management:** tagging, moderation, admin tools, anti-link, anti-spam, anti-bot, anti-sticker, anti-photo, anti-view-once, anti-mention, warnings, and member controls.
- **Media tools:** stickers, image/video/audio conversion, downloads, QR tools, OCR, translation, text-to-speech, and media utilities.
- **Status publishing:** post text, images, or videos to WhatsApp Status with `.tostatus`, including captions and quoted media.
- **Access modes:** `public`, `private`, `group`, and `dm`, persisted safely across restarts.
- **Diagnostics:** `.test`, `.ping`, `.speed`, `.health`, `.runtime`, and `.botinfo`.
- **Structured command menu:** use `.menu` and category menus instead of memorizing every command.
- **Optional providers:** Groq/Grok, AI-compatible APIs, media APIs, and other integrations are enabled only when configured.
- **Session safety:** bundled sessions are imported into a private auth directory; real credentials are never required in the repository.

## Requirements

- Node.js **18 or newer**; Node.js 20+ is recommended.
- Git and npm.
- A persistent host or process manager. Do not deploy the bot as a short-lived serverless function because its WhatsApp socket must remain connected.
- Outbound HTTPS/WebSocket access to WhatsApp and any optional providers you configure.

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/networkserver06-commits/LEE-TECHBOT-MD.git
cd LEE-TECHBOT-MD
npm ci
```

### 2. Create the local environment file

```bash
cp .env.example .env
```

Edit `.env` locally or add the same values through your hosting provider. Never commit `.env` or paste its contents into a public issue.

The default template uses private mode:

```env
BOT_MODE=private
PREFIX=.
AUTH_DIR=./auth
TIME_ZONE=Africa/Nairobi
```

### 3. Link WhatsApp

The recommended method is the separate pairing site:

**https://proper-badger-techlee-pair.koyeb.app/**

Use QR scan whenever possible. If you use a pairing code, enter it immediately on the same phone and do not request multiple codes for the same number. After successful linking, the site sends one complete `SESSION_BUNDLE=...` line.

Add the bundle to `.env` or your host’s secret/environment settings:

```env
AUTH_DIR=./auth
SESSION_BUNDLE=...paste-the-complete-value-here...
```

Restart the bot. The bundle is imported into `AUTH_DIR` once, and future Baileys key updates are persisted there. Do not upload `creds.json`, split the bundle across lines, or expose the bundle; it grants access to the linked WhatsApp session.

### 4. Start the bot

```bash
npm start
```

Useful alternatives:

```bash
npm run start:bot       # Run index.js directly
npm run start:panel     # Panel-friendly memory limit
npm run start:termux    # Termux-oriented start
npm run start:fresh     # Reset the configured session, then start
```

## Bot access modes

The selected mode is persisted in `data/botMode.json` and mirrored to the environment when possible.

| Mode | Who can use the bot |
|---|---|
| `public` | Everyone in groups and private chats |
| `private` | Linked owner, sudo identities, and developer account |
| `group` | Everyone in groups; restricted in private chats |
| `dm` | Everyone in private chats; restricted in groups |

Change or inspect the mode with:

```text
.mode public
.mode private
.mode group
.mode dm
.mode
```

Use `private` mode when the bot should respond only to the linked operator and trusted sudo identities.

## Core commands

The configured prefix is `.` by default. Run `.menu` for the live command catalog and `.help <command>` for focused guidance.

### Diagnostics

```text
.test
.ping
.speed
.health
.runtime
.botinfo
```

### WhatsApp Status

These commands require the linked owner or an authorized sudo identity:

```text
.tostatus hello 👋
```

Reply to a text, image, or video with:

```text
.tostatus
```

To replace a quoted media caption:

```text
.tostatus New caption 🎬
```

You can also send an image or video with a `.tostatus` caption. `.togstatus` posts content to the current group and mentions its members where supported.

### Group moderation

Examples include:

```text
.menu groups
.listgroup
.tagall
.antilink on
.antilink get
.antilink off
.antibot on
.antispam on
.antibadword on
.antidemote on
```

Only authorized users and group admins can run sensitive moderation actions. The bot checks the bot’s own admin status before attempting group operations.

### Owner DM group targeting

The linked owner can use `.listgroup` to obtain participating-group indexes, then target a group from private chat:

```text
.listgroup
.antilink 1 set all silent
.antibot 1 on
.antiphoto 1 on
.antisticker 1 on
.antiviewonce 1 on
```

A full group JID can also be used instead of an index. Ordinary users cannot configure another group from private chat.

### Media and fun

```text
.sticker       # Reply to an image/video
.play <song>
.song <song>
.ytmp4 <url or search>
.tts <text>
.translate <text> <language>
.ocr            # Reply to an image
.tictactoe
.note <text>
.rate <text>
```

Some media and AI commands require provider credentials or may be unavailable when an external service is down. The bot reports provider availability instead of pretending that an operation succeeded.

## Optional AI configuration

The bot can use Groq/Grok-compatible configuration when credentials are available:

```env
GROQ_API_KEY=your_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
GROQ_TEMPERATURE=0.7
GROQ_MAX_TOKENS=700
```

Use `.groq <question>` or `.grok <question>`. Keep API keys in host secrets or a local untracked `.env` file.

For a generic OpenAI-compatible provider, configure:

```env
AI_API_URL=https://your-provider.example/v1
AI_API_KEY=your_api_key_here
AI_MODEL=your-model-name
AI_TIMEOUT_MS=30000
AI_MAX_RETRIES=2
```

## Configuration reference

Start from [.env.example](.env.example). Common settings include:

| Variable | Purpose |
|---|---|
| `BOT_MODE` | Access mode: `public`, `private`, `group`, or `dm` |
| `PREFIX` | Command prefix, normally `.` |
| `AUTH_DIR` | Private directory for live WhatsApp credentials |
| `SESSION_BUNDLE` | One-time session bundle from the pairing site |
| `OWNER_NUMBER` | Optional full international owner number |
| `SUPER_OWNER_NUMBER` | Optional trusted sudo number |
| `TIME_ZONE` | Runtime timezone, for example `Africa/Nairobi` |
| `COMMAND_RATE_LIMIT` | Maximum commands allowed per rate window |
| `COMMAND_RATE_WINDOW_MS` | Command rate-limit window in milliseconds |
| `LOG_LEVEL` | Runtime log level |
| `PAIRING_WEB_ENABLED` | Enable the bot’s optional web-pairing integration when supported by the host |
| `PAIRING_WEB_TOKEN` | Optional token protecting the web-pairing endpoint |

Use full international phone numbers without spaces, brackets, or a leading plus where a number is required.

## Deployment

### Generic Node host

Use these settings on a persistent Node host:

- **Install command:** `npm ci --omit=dev --no-audit --no-fund`
- **Start command:** `npm start`
- **Node version:** 18+, preferably 20+
- **Persistent storage:** preserve `AUTH_DIR`, `data/`, and any runtime configuration files
- **Environment:** configure secrets through the host panel, not committed files

The process must be allowed to run continuously. Restarting the bot while deleting or replacing the auth directory will require a fresh WhatsApp link.

### VPS or process manager

```bash
npm ci --omit=dev --no-audit --no-fund
npm start
```

Use a process manager such as systemd, PM2, or the host’s native service manager. Keep one bot process per auth directory; multiple processes sharing the same WhatsApp session can corrupt Signal state and cause decryption or “Waiting for this message” errors.

### Termux

```bash
npm run deploy:termux
```

Keep the phone or server awake enough for the WhatsApp WebSocket connection to remain active.

## Validation and development

Run the checks before deploying changes:

```bash
npm run check
npm run audit:menu
```

`npm run check` validates the main entrypoints and runs the complete Node test suite. The menu audit reports catalog coverage and helps identify provider-backed commands that need configuration.

## Troubleshooting

### “Waiting for this message” or decryption errors

This usually means the linked Signal session is stale, corrupted, or being used by more than one process. Stop duplicate bot processes, keep only one process connected to the auth directory, and restart using the same valid auth directory. If the session remains broken, unlink the old device in WhatsApp, remove the configured auth directory, generate a fresh session bundle, and link again.

Already-stuck messages cannot be decrypted retroactively. New messages after a clean relink should work normally.

### Pairing code rejected

Use the QR method on the pairing site first. If using a code, request only one fresh code, enter it immediately, and verify that the phone number includes the country code and digits only. Do not repeatedly retry after WhatsApp reports rate limiting; wait before trying again.

### The bot does not answer in private chat

Check `BOT_MODE`, confirm that the sender is the linked owner or configured sudo identity, and verify `OWNER_NUMBER` uses the full international format. Run `.mode` and `.health` from an authorized chat.

### Media or AI commands fail

Check the required API keys, provider quota, network access, and command-specific input. External services can be unavailable even when the WhatsApp connection is healthy.

## Security checklist

- Never commit `.env`, `SESSION_BUNDLE`, `creds.json`, auth folders, API keys, or generated session files.
- Use a private `AUTH_DIR` with restricted filesystem permissions.
- Do not share the pairing-site session message; it grants access to the linked account.
- Keep one bot process per auth directory.
- Use `BOT_MODE=private` until you intentionally configure broader access.
- Do not use the bot for spam, unsolicited bulk messaging, harassment, or illegal activity.
- If a session or API key is exposed, revoke/rotate it immediately.

## License and attribution

This project is distributed under the [MIT License](LICENSE). It uses open-source libraries including [Baileys](https://github.com/WhiskeySockets/Baileys). See `package.json` for the complete dependency list.

LEE TECH BOT is not affiliated with, authorized by, or endorsed by WhatsApp or Meta. The maintainers are not responsible for account restrictions, data loss, or misuse of the software.

## Support and contributions

Issues and feature requests are welcome through the [GitHub Issues](https://github.com/networkserver06-commits/LEE-TECHBOT-MD/issues) page. Please remove all credentials and private session information before sharing logs or screenshots.
