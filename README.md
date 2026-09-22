# 🤖 LEE TECH BOT

This is a WhatsApp bot built using the Baileys library for group management, including features like tagging all members, muting/unmuting, and many more. It's designed to help admins efficiently manage WhatsApp groups.

<div align="center"> 
  <a href="https://git.io/typing-svg"> 
    <img src="https://readme-typing-svg.demolab.com?font=Ribeye&size=50&pause=1000&color=33ff00&center=true&width=910&height=100&lines=LEE+TECH-Bot;Multi+Device+Whatsapp+Bot;Coded+By+LEE+TECH" alt="Typing SVG" />
  </a> 
</div> 

<div align="center"> 
  <a href="https://youtube.com/@netwoekserver06"> 
    <img src="https://github.com/networkserver06-commits/LEE-TECHBOT-MD/blob/main/assets/bot_image.jpg" alt="LEE TECHBOT" height="300"> 
  </a> 
</div>

<div align="center">
  <img src="https://img.shields.io/github/followers/networkserver06-commits?style=for-the-badge&label=Followers" alt="Followers"/>
  <img src="https://img.shields.io/github/stars//networkserver06-commits/LEE-TECHBOT-MD?style=for-the-badge&label=Stars" alt="Stars"/>
  <img src="https://img.shields.io/github/forks//networkserver06-commits/LEE-TECHBOT-MD?style=for-the-badge&label=Forks" alt="Forks"/>
  <img src="https://img.shields.io/github/watchers/networkserver06-commits/LEE-TECHBOT-MD?style=for-the-badge&label=Watchers" alt="Watchers"/>
</div>


## 🚀 Steps to Deploy Bot

### Step 1: Fork the Repository

Click the button below to fork the LEE TECH BOT repository to your GitHub account:

<div align="center">
  <a href="https://github.com/networkserver06-commits/LEE-TECHBOT-MD/fork">
    <img src="https://img.shields.io/badge/Fork-Repository-blue?style=for-the-badge" alt="Fork the repository"/>
  </a>
</div>

---

### Step 2: Get Pair Code

Deploy the bot and easily connect it to your WhatsApp account by pair code. Click the button below to pair your WhatsApp.

<div align="center">
  <a href="https://lee-techbot-pair.onrender.com" target="_blank">
    <img src="https://img.shields.io/badge/GET%20PAIR%20CODE-Easy%20Method-ff4d4d?style=for-the-badge" alt="Generate Pair Code"/>
  </a>
</div>


### After getting creds.json file, upload it to session folder

---

### Step 3: Deploy Now

For further customization and setup guidance, click the button below:

<div align="center">
  <a href="https://youtu.be/-oz_u1iMgf8">
    <img src="https://img.shields.io/badge/Deploy Tutorial-dc3545?style=for-the-badge&logo=youtube" alt="YouTube Link"/>
  </a>
  <a href="https://bot-hosting.net/?aff=1068419752923508776">
    <img src="https://img.shields.io/badge/Deploy on Panel-28a745?style=for-the-badge" alt="Deploy on Panel"/>
  </a>
</div>

### Deploy on VPS

<div align="center">
  <a href="https://client.petrosky.io/aff.php?aff=394" target="_blank">
    <img src="https://img.shields.io/badge/petrosky vps-0078E7?style=for-the-badge" alt="petrosky vps"/>
  </a>
</div>

### Deploy on Below Panel
<div align="center">
<a href="https://dashboard.katabump.com/auth/login#d6b7d6" target="_blank">
  <img src="https://img.shields.io/badge/Katabump-D6B7D6?style=for-the-badge&logo=server&logoColor=black" alt="Katabump"/>
</a>
</div>

### Join Us

<div align="center">
  <a href="https://t.me/+3QhFUZHx-nhhZmY1">
    <img src="https://img.shields.io/badge/Join%20Telegram-0078E7?style=for-the-badge&logo=telegram&logoColor=white" alt="Join Telegram"/>
  </a>
  <a href="https://whatsapp.com/channel/0029VbBu1EgJUM2iVI3tPE0S/154">
    <img src="https://img.shields.io/badge/Join%20WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Join WhatsApp"/>
  </a>
</div>

---

## ⚙️ Features

- **Tag all group members** with the `.tagall` command
- **Admin restricted usage** (Only group admins can use certain commands)
- **Games** like Tic-Tac-Toe for interactive group engagement
- **Text-to-Speech** with `.tts`
- **Sticker creation** with `.sticker`
- **Anti-link detection** for group safety
- **Warn and manage group members** with admin control

---

## 🔗 Anti-link controls

Group administrators can configure anti-link behavior in the group. The linked account can also configure a group privately by DM, which is useful when the bot is already linked and the operator does not want to expose setup commands in the group.

In a group, use `.antilink on`, `.antilink off`, `.antilink get`, or `.antilink set <mode> [silent|loud] [allow domains] [deny domains]`. Supported modes are `all`, `scam`, `whatsapp`, `telegram`, and `custom`. Silent mode deletes the offending message without posting a warning or notification. The default for the explicit `.antilink on` command is silent deletion.

To automatically ban repeat offenders, set the action to `ban` with `.antilink action ban`. The bot counts unauthorized-link violations per group and user and, after the configured threshold, adds the user to the global ban list and removes them from the group. Set the threshold with `.antilink threshold 5` (valid values are 1–100); it is stored per group and defaults to `WARN_COUNT` or three. Group admins, the bot account, and sudo identities are exempt.

From the linked account DM, include the target group number or JID first:

```text
.antilink 120363000000000000@g.us set all silent allow chat.whatsapp.com,wa.me deny bit.ly
.antilink 120363000000000000@g.us set scam silent
.antilink 120363000000000000@g.us get
.antilink 120363000000000000@g.us off
.antilink 120363000000000000@g.us action ban
.antilink 120363000000000000@g.us threshold 5
```

Allowed domains are never deleted, so WhatsApp links can be permitted while other links are blocked. Denied domains always take priority unless they are also explicitly allowed. Only the linked account owner or an authorized sudo identity can change another group’s settings from DM.

---

## 📖 About

The LEE TECH WhatsApp Bot assists group admins by providing them with tools to efficiently manage large WhatsApp groups. The bot uses the Baileys library to interact with the WhatsApp Web API and supports multi-device features.

It is lightweight and can be easily customized to add more commands as per your requirements. The bot runs in a Node.js environment and provides QR code-based authentication to link your WhatsApp account.

---

## 🛠️ Setup & Installation

### Prerequisites

- Node.js installed on your system
- Git installed (for cloning the repository)

### Step-by-Step Setup

1. **Clone the repository:**

    ```bash
    git clone [https://github.com/networkserver-commits06/LEE-TECHBOT-MD.git
    cd LEE-TECHBOT-MD
    ```

2. **Install the dependencies:**

    ```bash
    npm install
    ```

3. **Configure Groq/Grok AI:**

    Use the existing `.env` file in the repository. Add your provider key to either `GROQ_API_KEY` (preferred) or `GROK_API_KEY`, then restart the bot:

    ```env
    GROQ_API_KEY=your_api_key_here
    # GROK_API_KEY=your_api_key_here
    GROQ_MODEL=llama-3.3-70b-versatile
    GROQ_TEMPERATURE=0.7
    GROQ_MAX_TOKENS=700
    ```

    Use `.groq <question>` or `.grok <question>` in WhatsApp. Keep real API keys private and do not post them in public issues or commits.

4. **Run the bot:**

    ```bash
    node index.js
    ```

5. **Link the bot:**

For pairing-code login, open the pairing website using your hosting panel's public host link. **The first time the page is opened, create a website password and confirm it before the phone-number form or account status is available.** The host stores only a salted `scrypt` password hash in the configured `AUTH_DIR` as `.pairing-web-password.json`; the plaintext password is never stored. On later visits or after a restart, enter the same password first. If WhatsApp disconnects, the web session and saved pairing password are automatically removed; the next visit must create and confirm a new password. Then enter your full international phone number without `+`, spaces, or dashes, press **Generate pairing code**, and enter the displayed code in WhatsApp under **Settings → Linked Devices → Link a Device**.

    The website binds to `0.0.0.0` and uses the host-provided `SERVER_PORT` automatically. To expose it through a hosting panel or reverse proxy, set these values in the existing `.env` file and use a long random token:

    ```env
    PAIRING_WEB_ENABLED=true
    PAIRING_WEB_HOST=0.0.0.0
    PAIRING_WEB_PORT=
    PAIRING_WEB_TOKEN=replace-with-a-long-random-secret
    PAIRING_WEB_ONLY=true
    PAIRING_INPUT_MODE=choose
    ```

With `PAIRING_INPUT_MODE=choose`, startup asks whether to use **Website** or **Terminal** pairing. Both methods remain available: Website asks for the website password and phone number on the host link, while Terminal asks for the phone number in the host console. Use `PAIRING_INPUT_MODE=web` to skip the choice and use the website, or `PAIRING_INPUT_MODE=terminal` to skip it and use the terminal. Send the token as the `X-Pairing-Token` header if calling the API directly. Keep the pairing page, password, and token private because a pairing code can link the bot to a WhatsApp account.

    To allow both methods, set `PAIRING_WEB_ONLY=false`. The host terminal will then accept a phone number when no valid `PHONE_NUMBER` or `PAIRING_NUMBER` is configured, while the website remains available. To always show the terminal prompt, even when a number is already configured, also set `PAIRING_TERMINAL_PROMPT=true`.

---


## 📄 License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT) - see the [LICENSE](https://github.com/networkserver-commits06/LEE-TECHBOT-MD/blob/main/LICENSE) file for details.

---

## 🙌 Contributions

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/networkserver-commits06/LEE-TECHBOT-MD/issues).

---

## 🌟 Show your support

If you like this project, please give it a [⭐️ star on GitHub](https://github.com/networkserver-commits06)!


## Credits
- [LEE TECH](github.com/networkserver-commits06)
- [Professor](https://github.com/mruniquehacker) for code scripts and teaching
- [Baileys](https://github.com/adiwajshing/Baileys)
- [TechGod143](https://github.com/TechGod143) for pair code
- [Dgxeon](https://github.com/Dgxeon) for pair code

---

## ⚠️ Important Warning

**Note:** This bot is created for educational purposes only. This is NOT an official WhatsApp bot. Using this bot may lead to your WhatsApp account being banned. Use it at your own risk. The developers will not be responsible for any consequences or account bans that may occur while using this bot.

## 📝 Legal

- This project is not affiliated with, authorized, maintained, sponsored or endorsed by WhatsApp or any of its affiliates or subsidiaries.
- This is an independent and unofficial software. Use at your own risk.
- Do not spam people with this bot.
- Do not use this bot to send bulk messages or for illegal purposes.
- The developers assume no liability and are not responsible for any misuse or damage caused by this program.

### License
This project is licensed under the MIT License. However, you must:
- Use this software in compliance with all applicable laws and regulations
- Include original license and copyright notices
- Credit original authors
- Not use for spam or malicious purposes

## 📜 Copyright Notice

Copyright (c) 2025 LEE TECH. All rights reserved.

This project contains code from various open source projects:
- Baileys (MIT License)
- Other libraries as listed in package.json

## Upgraded command menu

The bot now exposes the supplied command families through a structured menu catalog. Use `.menu` to view the category index, then use `.menu settings`, `.menu groups`, `.menu ai`, `.menu anime`, `.menu img-maker`, `.menu convert`, `.menu fun`, `.menu downloads`, or `.menu general` for a focused view. The configured prefix is applied automatically.

The menu catalog is intentionally separate from command execution so existing handlers remain stable while additional commands can be implemented incrementally. Commands that are not implemented by the current checkout should not be enabled in production until their handler and permissions are added.

## Environment safety

Runtime credentials and deployment values belong in the existing `.env` file or hosting-panel secrets. Keep real API keys private and never post them in public issues or commits.
