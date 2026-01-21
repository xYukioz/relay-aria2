const activeNotifications = [];
const NOTIFICATION_HEIGHT = 100;
const GAP = 10;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "show_notification") {
        showNotification(request.data);
        sendResponse({status: "received"});
    }
});

function showNotification(data) {
    const el = document.createElement('div');
    el.className = 'relay-notification';

    Object.assign(el.style, {
        position: 'fixed',
        backgroundColor: '#000000',
        color: '#eeeeee',
        fontFamily: 'monospace',
        fontSize: '13px',
        padding: '15px',
        zIndex: '999999',
        border: '1px solid #444',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        minWidth: '250px',
        maxWidth: '400px',
        borderRadius: '4px',
        opacity: '0',
        transition: 'all 0.3s ease-in-out',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    });

    const title = data.title || "relay";
    const message = data.message || "";

    let detailsHtml = '';
    if (data.details) {
        if (data.details.filename) detailsHtml += `<div style="color:#00ff00; word-break: break-all;">> ${escapeHtml(data.details.filename)}</div>`;
        if (data.details.size) detailsHtml += `<div style="color:#888;">Size: ${data.details.size}</div>`;
        if (data.details.source) detailsHtml += `<div style="color:#888;">Source: ${escapeHtml(data.details.source)}</div>`;
    }

    el.innerHTML = `
        <div style="border-bottom: 1px solid #333; padding-bottom: 4px; margin-bottom: 4px; font-weight: bold; color: #10B981; display:flex; justify-content:space-between;">
            <span>${escapeHtml(title)}</span>
        </div>
        <div>${escapeHtml(message)}</div>
        ${detailsHtml}
    `;

    document.body.appendChild(el);

    const pos = data.position || 'top-right';

    const MAX_NOTIFICATIONS = 4;
    const notificationsInStack = activeNotifications.filter(t => t.position === pos);
    if (notificationsInStack.length >= MAX_NOTIFICATIONS) {
        for (let i = activeNotifications.length - 1; i >= 0; i--) {
            if (activeNotifications[i].position === pos) {
                removeNotification(activeNotifications[i]);
                break;
            }
        }
    }

    const notificationData = {
        element: el,
        position: pos,
        height: 0
    };

    activeNotifications.unshift(notificationData);

    requestAnimationFrame(() => {
        notificationData.height = el.offsetHeight;
        updatePositions();
        el.style.opacity = '1';
    });

    setTimeout(() => {
        removeNotification(notificationData);
    }, 5000);
}

function removeNotification(data) {
    const index = activeNotifications.indexOf(data);
    if (index > -1) {
        activeNotifications.splice(index, 1);
        data.element.style.opacity = '0';
        data.element.style.transform = 'scale(0.9)';
        setTimeout(() => data.element.remove(), 300);
        updatePositions();
    }
}

function updatePositions() {
    const stacks = {
        'top-right': 20,
        'top-left': 20,
        'bottom-right': 20,
        'bottom-left': 20
    };

    activeNotifications.forEach((item) => {
        const el = item.element;
        const pos = item.position;
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

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
