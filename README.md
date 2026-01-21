# relay-aria2

bring the power of aria2 to your browser.

**aria2** is a lightweight, multi-protocol download utility (supports http/https, ftp, sftp, bittorrent, and metalink) that usually runs in the command line.

**relay-aria2** acts as a bridge between your browser and aria2. instead of using the default slow download manager, it hands over the job to aria2 automatically.

## why use this?

it combines the best of both worlds:

- **easy to use**: download files using aria2's advanced engine without touching a terminal.
- **seamless**: just click like normal. we handle the cookies, headers, and authentication so downloads just work.
- **smart filters**: automatically ignore small files (like images) or block specific sites.
- **clean**: runs quietly in the background.

## how to setup

### step 1: prepare aria2
make sure aria2 is running with rpc enabled:
```bash
aria2c --enable-rpc --rpc-allow-origin-all --rpc-listen-all --rpc-listen-port=6800 --rpc-secret=SomethingSecure
```

### step 2: install extension
load this folder in your browser (`chrome://extensions` -> developer mode -> load unpacked).

### step 3: connect
click the extension icon -> options, and enter your `rpc url` and `token`.

## useful tips

- **full control**: use [ariang](https://github.com/mayswind/AriaNg) to fully monitor and control your downloads with a powerful interface.
- **filters**: check the settings if you only want to catch big files (e.g. `.iso`, `.mkv`).

## license

mit
