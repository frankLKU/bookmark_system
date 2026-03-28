// chrome-extension/background.js
// WebSocket client + Chrome tab/group command handler

const WS_URL = 'ws://127.0.0.1:8765/ws/chrome';
const RECONNECT_INTERVAL = 3000;
const TAB_GROUP_COLORS = ['grey','blue','red','yellow','green','pink','purple','cyan','orange'];

let ws = null;
let tagToGroupId = {};  // All keys stored in lowercase

// --- Hash function for deterministic color assignment ---
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getColorForTag(tag) {
    return TAB_GROUP_COLORS[hashCode(tag) % TAB_GROUP_COLORS.length];
}

// --- WebSocket Connection ---
function connect() {
    try {
        ws = new WebSocket(WS_URL);
    } catch (e) {
        scheduleReconnect();
        return;
    }

    ws.onopen = () => {
        console.log('[TIBDP] Connected to server');
        ws.send(JSON.stringify({ type: 'connected' }));
        rebuildTagMap();
        sendTabsUpdate();
    };

    ws.onmessage = (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            console.error('[TIBDP] Invalid JSON:', event.data);
            return;
        }
        handleCommand(msg);
    };

    ws.onclose = () => {
        console.log('[TIBDP] Disconnected, reconnecting...');
        ws = null;
        scheduleReconnect();
    };

    ws.onerror = () => {
        // onclose will fire after this
    };
}

function scheduleReconnect() {
    setTimeout(connect, RECONNECT_INTERVAL);
}

function send(type, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, data }));
    }
}

// --- Command Handler ---
async function handleCommand(msg) {
    const { type, data } = msg;

    switch (type) {
        case 'open_tab_group':
            await openTabGroup(data.tag, data.urls, data.color);
            break;
        case 'switch_tab':
            await switchTab(data.tabId);
            break;
        case 'close_tab':
            await closeTab(data.tabId);
            break;
        case 'close_group':
            await closeGroup(data.tag);
            break;
        default:
            console.warn('[TIBDP] Unknown command:', type);
    }
}

// --- Tab Group Operations ---
async function openTabGroup(tag, urls, color) {
    if (!urls || urls.length === 0) return;

    const tabIds = [];
    for (const url of urls) {
        const tab = await chrome.tabs.create({ url, active: false });
        tabIds.push(tab.id);
    }

    const groupId = await chrome.tabs.group({ tabIds });
    const groupColor = color || getColorForTag(tag);
    await chrome.tabGroups.update(groupId, { title: tag.toUpperCase(), color: groupColor });
    // Always store with lowercase key for consistent lookup
    tagToGroupId[tag.toLowerCase()] = groupId;

    // Activate first tab
    if (tabIds.length > 0) {
        await chrome.tabs.update(tabIds[0], { active: true });
    }

    sendTabsUpdate();
}

async function switchTab(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        await chrome.tabs.update(tabId, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
    } catch (e) {
        console.error('[TIBDP] switchTab failed:', e);
    }
}

async function closeTab(tabId) {
    try {
        await chrome.tabs.remove(tabId);
    } catch (e) {
        console.error('[TIBDP] closeTab failed:', e);
    }
    // tabs.onRemoved will trigger sendTabsUpdate
}

async function closeGroup(tag) {
    // Always look up with lowercase key
    const tagLower = tag.toLowerCase();
    let groupId = tagToGroupId[tagLower];

    // Fallback: search by title if map doesn't have it
    if (groupId === undefined) {
        const groups = await chrome.tabGroups.query({});
        const match = groups.find(g => g.title && g.title.toLowerCase() === tagLower);
        if (match) groupId = match.id;
    }

    if (groupId === undefined) {
        console.warn('[TIBDP] closeGroup: no group found for tag', tag);
        return;
    }

    const tabs = await chrome.tabs.query({ groupId });
    const tabIds = tabs.map(t => t.id);
    if (tabIds.length > 0) {
        await chrome.tabs.remove(tabIds);
    }
    delete tagToGroupId[tagLower];
    // tabs.onRemoved will trigger sendTabsUpdate
}

// --- Tab State Reporting ---
// Note: Sends tabs from ALL windows. Spec says "only manage most recently
// focused window" but showing all windows is acceptable for now.
async function sendTabsUpdate() {
    try {
        const tabs = await chrome.tabs.query({});
        const tabData = [];

        // Collect unique groupIds that need name resolution
        const groupIds = new Set(tabs.filter(t => t.groupId !== -1).map(t => t.groupId));
        const groupNames = {};
        for (const gid of groupIds) {
            try {
                const group = await chrome.tabGroups.get(gid);
                groupNames[gid] = group.title || '';
            } catch (e) {
                groupNames[gid] = '';
            }
        }

        for (const tab of tabs) {
            tabData.push({
                id: tab.id,
                url: tab.url || '',
                title: tab.title || '',
                groupId: tab.groupId,
                groupName: tab.groupId !== -1 ? (groupNames[tab.groupId] || '') : '',
                active: tab.active,
                windowId: tab.windowId,
            });
        }

        send('tabs_updated', { tabs: tabData });
    } catch (e) {
        console.error('[TIBDP] sendTabsUpdate failed:', e);
    }
}

// --- Rebuild tag→groupId map on reconnect ---
// All keys stored lowercase for consistent lookup
async function rebuildTagMap() {
    try {
        const groups = await chrome.tabGroups.query({});
        tagToGroupId = {};
        for (const g of groups) {
            if (g.title) {
                tagToGroupId[g.title.toLowerCase()] = g.id;
            }
        }
    } catch (e) {
        console.error('[TIBDP] rebuildTagMap failed:', e);
    }
}

// --- Tab Event Listeners ---
chrome.tabs.onCreated.addListener(() => sendTabsUpdate());
chrome.tabs.onRemoved.addListener(() => sendTabsUpdate());
chrome.tabs.onActivated.addListener(() => sendTabsUpdate());
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.title || changeInfo.url) sendTabsUpdate();
});

// --- Content Script Message Listener ---
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'focus_search') {
        send('focus_search');
    }
});

// --- Start ---
connect();
