const DEFAULT_RPC = "http://localhost:6800/jsonrpc";
const DEFAULT_TOKEN = "SomethingSecure";

const actionAPI = chrome.action || chrome.browserAction;

let isActive = false;

function set_state(active) {
    isActive = active;

    actionAPI.setBadgeText({ text: "" });
    actionAPI.setBadgeBackgroundColor({ color: active ? "#10B981" : "#EF4444" });

    if (isActive) {
        connect_ws();
    } else {
        if (socket) socket.close();
    }
}

chrome.storage.local.get(['enabled'], (result) => {
    set_state(result.enabled || false);
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.enabled) {
            set_state(changes.enabled.newValue);
        }
        if (changes.rpcUrl && isActive) {
            if(socket) socket.close();
            connect_ws();
        }
    }
});

actionAPI.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});

function get_cookies(url) {
    return new Promise((resolve) => {
        if (!chrome.cookies) {
             resolve(null);
             return;
        }
        chrome.cookies.getAll({url: url}, (cookies) => {
            if (!cookies || cookies.length === 0) {
                resolve(null);
                return;
            }
            const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            resolve(cookieStr);
        });
    });
}

function sanitize_filename(filename) {
    if (!filename) return null;
    return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/^\.+/, "");
}

async function notify(title, message, details = null) {
    const config = await chrome.storage.local.get({ notificationPosition: 'top-right' });

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs && tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "show_notification",
                data: {
                    title: title,
                    message: message,
                    position: config.notificationPosition,
                    details: details
                }
            }).catch(() => {});
        }
    });

    return Promise.resolve({ success: true });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "download-with-relay",
        title: "download with relay",
        contexts: ["link", "image", "video", "audio"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "download-with-relay") {
        const url = info.linkUrl || info.srcUrl;
        if (!url) return;

        const referrer = info.pageUrl;
        const cookies = await get_cookies(url);

        let filename = null;
        try {
            const urlPath = new URL(url).pathname;
            const possibleName = urlPath.split('/').pop();
            if (possibleName && possibleName.includes('.')) {
                filename = sanitize_filename(decodeURIComponent(possibleName));
            }
        } catch(e) {}

        send(url, filename, referrer, cookies);
    }
});

const recentDownloads = new Set();
const gidMap = new Map();
let socket = null;
let reconnectTimer = null;

async function connect_ws() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const config = await chrome.storage.local.get({
        rpcUrl: DEFAULT_RPC,
        rpcToken: DEFAULT_TOKEN
    });

    let wsUrl = config.rpcUrl.replace(/^http/, 'ws');

    try {
        socket = new WebSocket(wsUrl);
    } catch (e) {
        console.error("ws creation failed", e);
        scheduleReconnect();
        return;
    }

    socket.onopen = () => {
        if (reconnectTimer) clearTimeout(reconnectTimer);
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handle_ws_message(data);
        } catch (e) {
            console.error("ws parse error", e);
        }
    };

    socket.onclose = () => {
        socket = null;
        schedule_reconnect();
    };

    socket.onerror = (err) => {
        console.error("ws error", err);
    };
}

function schedule_reconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        if (isActive) connect_ws();
    }, 5000);
}

function handle_ws_message(msg) {
    if (!msg || !msg.method) return;

    if (msg.method === "aria2.onDownloadStart") {
        const gid = msg.params[0].gid;
        const info = gidMap.get(gid);
        if (info) {
             notify("relay", "download started", { filename: info.filename, source: new URL(info.url).hostname });
        }
    } else if (msg.method === "aria2.onDownloadComplete") {
        const gid = msg.params[0].gid;
        const info = gidMap.get(gid);
        notify("relay", "download completed", { filename: info ? info.filename : "GID: " + gid });
        if(info) gidMap.delete(gid);
    } else if (msg.method === "aria2.onDownloadError") {
        const gid = msg.params[0].gid;
        const info = gidMap.get(gid);
        notify("relay", "download error", { filename: info ? info.filename : "GID: " + gid });
        if(info) gidMap.delete(gid);
    }
}


async function send(url, filename, referrer, cookies, fileSize = 0, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;

    const config = await chrome.storage.local.get({
        rpcUrl: DEFAULT_RPC,
        rpcToken: DEFAULT_TOKEN,
        downloadDir: ''
    });

    let headers = [];
    if (referrer) {
        headers.push(`Referer: ${referrer}`);
    }
    if (cookies) {
        headers.push(`Cookie: ${cookies}`);
    }
    headers.push(`User-Agent: ${navigator.userAgent}`);

    const aria2Options = {
        "header": headers
    };

    if (filename) {
        aria2Options["out"] = filename;
    }

    if (config.downloadDir && config.downloadDir.trim()) {
        aria2Options["dir"] = config.downloadDir.trim();
    }

    const rpcData = {
        jsonrpc: "2.0",
        method: "aria2.addUri",
        id: "relay-" + Date.now(),
        params: [
            config.rpcToken ? `token:${config.rpcToken}` : undefined,
            [url],
            aria2Options
        ].filter(x => x !== undefined)
    };

    try {
        const response = await fetch(config.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rpcData)
        });
        const result = await response.json();

        if (result.error) {
            throw new Error(result.error.message || "aria2 returned an error");
        }

        if (result.result) {
            gidMap.set(result.result, { filename: filename || "Unknown File", url: url, size: fileSize });
        }

        const sizeStr = fileSize > 0 ? (fileSize / 1024 / 1024).toFixed(2) + " MB" : "";
        notify("relay", "request sent", {
            filename: filename || "unknown file",
            size: sizeStr,
            source: new URL(url).hostname
        });

        actionAPI.setBadgeText({ text: "●" });
        actionAPI.setBadgeBackgroundColor({ color: "#3B82F6" });
        setTimeout(() => {
            if(isActive) {
               actionAPI.setBadgeBackgroundColor({ color: "#10B981" });
               actionAPI.setBadgeText({ text: "" });
            }
        }, 1500);

        connect_ws();

    } catch (error) {
        console.error(`aria2 request failed (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error);

        if (retryCount < MAX_RETRIES) {
            setTimeout(() => {
                send(url, filename, referrer, cookies, fileSize, retryCount + 1);
            }, RETRY_DELAY);
            return;
        }

        notify("relay error", "failed to connect to aria2 after " + (MAX_RETRIES + 1) + " attempts.");

        actionAPI.setBadgeText({ text: "!" });
        actionAPI.setBadgeBackgroundColor({ color: "#EF4444" });
        setTimeout(() => {
            if(isActive) set_state(isActive);
        }, 3000);
    }
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "download-with-relay",
            title: "download with relay",
            contexts: ["link", "image", "video", "audio"]
        });
    });
});

chrome.downloads.onDeterminingFilename.addListener(async (downloadItem, suggest) => {
    if (!isActive) {
         suggest();
         return;
    }

    if (downloadItem.url.startsWith("blob:") || downloadItem.url.startsWith("data:")) {
        suggest();
        return;
    }

    const cacheKey = downloadItem.url + "|" + downloadItem.filename;
    if (recentDownloads.has(cacheKey)) {
        suggest();
        return;
    }

    const config = await chrome.storage.local.get({
        minSize: '0',
        whitelist: '',
        blacklist: '',
        fileTypes: ''
    });

    if (config.fileTypes && config.fileTypes.trim()) {
        const allowedTypes = config.fileTypes.toLowerCase().split(',').map(t => t.trim()).filter(t => t);
        const ext = downloadItem.filename.split('.').pop().toLowerCase();
        if (!allowedTypes.includes(ext)) {
            suggest();
            return;
        }
    }

    const parseSize = (str) => {
        if (!str) return 0;
        const match = str.toString().match(/^([\d.]+)([kmgt]?)/i);
        if (!match) return 0;
        const val = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        const powers = { 'k': 1, 'm': 2, 'g': 3, 't': 4 };
        return val * Math.pow(1024, powers[unit] || 2);
    };

    const minSizeBytes = parseSize(config.minSize);
    const checkUrl = downloadItem.referrer || downloadItem.url;

    if (config.blacklist) {
        try {
            const blRegex = new RegExp(config.blacklist, 'i');
            if (blRegex.test(checkUrl)) {
                suggest();
                return;
            }
        } catch (e) {
             console.error("Invalid blacklist regex", e);
             suggest();
             return;
        }
    }

    if (config.whitelist) {
         try {
            const wlRegex = new RegExp(config.whitelist, 'i');
             if (!wlRegex.test(checkUrl)) {
                suggest();
                return;
            }
        } catch (e) {
            console.error("Invalid whitelist regex", e);
            suggest();
            return;
        }
    }

    if (minSizeBytes > 0 && downloadItem.fileSize > 0 && downloadItem.fileSize < minSizeBytes) {
        suggest();
        return;
    }

    recentDownloads.add(cacheKey);
    setTimeout(() => recentDownloads.delete(cacheKey), 5000);

    chrome.downloads.cancel(downloadItem.id, () => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
        }
    });
    chrome.downloads.erase({ id: downloadItem.id });


    const cookies = await get_cookies(downloadItem.url);
    const cleanFilename = sanitize_filename(downloadItem.filename);

    send(downloadItem.url, cleanFilename, downloadItem.referrer, cookies, downloadItem.fileSize);

    return true;
});
