const activeNotifications = [];
const GAP = 10;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "show_notification") {
        show_notification(request.data);
        sendResponse({status: "received"});
    }
});

function show_notification(data) {
    const host = document.createElement('div');
    host.className = 'relay-notification-host';

    Object.assign(host.style, {
        all: 'initial',
        position: 'fixed',
        zIndex: '2147483647',
        opacity: '0',
        transition: 'opacity 0.3s ease-in-out',
        pointerEvents: 'none',
        display: 'block',
        fontFamily: 'sans-serif',
        fontSize: '16px'
    });

    const shadow = host.attachShadow({mode: 'open'});

    const style = document.createElement('style');
    style.textContent = `
        :host {
            display: block;
        }
        .notification-card {
            background-color: #000000;
            color: #eeeeee;
            font-family: monospace, ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, courier, sans-serif;
            font-size: 13px;
            padding: 15px;
            border: 1px solid #444;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            min-width: 250px;
            max-width: 400px;
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            box-sizing: border-box;
            line-height: 1.4;
            text-align: left;
        }
        .header {
            border-bottom: 1px solid #333;
            padding-bottom: 4px;
            margin-bottom: 4px;
            font-weight: bold;
            color: #10B981;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .filename {
            color: #00ff00;
            word-break: break-all;
            margin: 2px 0;
        }
        .meta {
            color: #888;
            font-size: 12px;
        }
    `;
    shadow.appendChild(style);

    const card = document.createElement('div');
    card.className = 'notification-card';

    const title = escape_html(data.title || "relay");
    const message = escape_html(data.message || "");

    let detailsHtml = '';
    if (data.details) {
        if (data.details.filename) detailsHtml += `<div class="filename">> ${escape_html(data.details.filename)}</div>`;
        if (data.details.size) detailsHtml += `<div class="meta">Size: ${escape_html(data.details.size.toString())}</div>`;
        if (data.details.source) detailsHtml += `<div class="meta">Source: ${escape_html(data.details.source)}</div>`;
    }

    card.innerHTML = `
        <div class="header">
            <span>${title}</span>
        </div>
        <div>${message}</div>
        ${detailsHtml}
    `;

    shadow.appendChild(card);
    document.body.appendChild(host);

    const pos = data.position || 'top-right';

    const MAX_NOTIFICATIONS = 4;
    const notificationsInStack = activeNotifications.filter(t => t.position === pos);
    if (notificationsInStack.length >= MAX_NOTIFICATIONS) {
        for (let i = activeNotifications.length - 1; i >= 0; i--) {
            if (activeNotifications[i].position === pos) {
                remove_notification(activeNotifications[i]);
                break;
            }
        }
    }

    const notificationData = {
        element: host,
        position: pos,
        height: 0
    };

    activeNotifications.unshift(notificationData);

    requestAnimationFrame(() => {
        notificationData.height = host.offsetHeight;
        update_positions();
        host.style.opacity = '1';
    });

    setTimeout(() => {
        remove_notification(notificationData);
    }, 5000);
}

function remove_notification(data) {
    const index = activeNotifications.indexOf(data);
    if (index > -1) {
        activeNotifications.splice(index, 1);
        data.element.style.opacity = '0';

        setTimeout(() => data.element.remove(), 300);
        update_positions();
    }
}

function update_positions() {
    const stacks = {
        'top-right': 20,
        'top-left': 20,
        'bottom-right': 20,
        'bottom-left': 20
    };

    activeNotifications.forEach((item) => {
        const el = item.element;
        const pos = item.position;
            el.style.top = ''; el.style.bottom = ''; el.style.left = ''; el.style.right = '';
    const currentOffset = stacks[pos];

        el.style.top = ''; el.style.bottom = ''; el.style.left = ''; el.style.right = '';

        if (pos.includes('top')) {
            el.style.top = currentOffset + 'px';
        } else {
            el.style.bottom = currentOffset + 'px';
        }

        if (pos.includes('right')) {
            el.style.right = '20px';
        } else {
            el.style.left = '20px';
        }

        stacks[pos] += (item.height || el.offsetHeight) + 10;
    });
}

function escape_html(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
