// ============================================================================
// 1. CONFIGURATION, DOM ELEMENTS & AUTH GATEKEEPER
// ============================================================================
const BACKEND_HOST = 'http://127.0.0.1:8000';

// --- GLOBAL NGROK HEADER INTERCEPTOR ---
// const originalFetch = window.fetch;
// window.fetch = async (input, init = {}) => {
//     init.headers = {
//         ...init.headers,
//         'ngrok-skip-browser-warning': 'true'
//     };
//     return originalFetch(input, init);
// };
// ---------------------------------------

let CURRENT_USER_ID = localStorage.getItem('CURRENT_USER_ID');

if (!CURRENT_USER_ID) {
    console.warn("[AUTH WARNING] No active session found. Routing to login panel.");
    window.location.href = 'auth.html';
    CURRENT_USER_ID = "1"; 
} else {
    if (CURRENT_USER_ID.startsWith('{')) {
        try {
            const parsed = JSON.parse(CURRENT_USER_ID);
            CURRENT_USER_ID = String(parsed.user_id || parsed.id || CURRENT_USER_ID);
        } catch (e) {
            console.error("Error parsing stored user JSON:", e);
        }
    }
    CURRENT_USER_ID = String(CURRENT_USER_ID).trim();
}

// Updated mapping according to your new routers
const API_URLS = {
    // /user/session endpoints
    createSession: `${BACKEND_HOST}/user/session/new`, 
    getSessions: (userId) => `${BACKEND_HOST}/user/session/${userId}`, 
    deleteSession: (sessionId) => `${BACKEND_HOST}/user/session/${sessionId}`, 
    getMessages: (sessionId) => `${BACKEND_HOST}/user/session/${sessionId}/messages`, 
    streamChat: (sessionId) => `${BACKEND_HOST}/user/session/${sessionId}/chat`, 
    
    // /files endpoints
    uploadFile: `${BACKEND_HOST}/files/upload`, 
    getFiles: (sessionId) => `${BACKEND_HOST}/files/${sessionId}`, 
    deleteFile: `${BACKEND_HOST}/files/delete` 
};

// Global App State
let currentActiveSessionId = null;
let liveStreamAbortController = null;

// DOM Selectors
const sidebarSessionsContainer = document.getElementById('session-nav');
const chatWindowHistory = document.getElementById('chat-history');
const chatInputTextArea = document.getElementById('chat-input');
const chatForm = document.getElementById('chat-form');
const createSessionButton = document.getElementById('new-session-btn');
const attachedFilesTrackerList = document.getElementById('files-panel');
const fileUploadHiddenInput = document.getElementById('file-upload');
const toggleFilesButton = document.getElementById('toggle-files-btn');
const toastContainer = document.getElementById('toast-container');
const logoutButton = document.querySelector('.logout-btn');

// ============================================================================
// 2. LIFECYCLE INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const storedUsername = localStorage.getItem('CURRENT_USERNAME') || 'User';
    const userNameElement = document.querySelector('.user-profile .user-name');
    
    if (userNameElement) {
        userNameElement.textContent = storedUsername;
    }

    loadAllUserSessions();

    if (createSessionButton) {
        createSessionButton.addEventListener('click', triggerSessionCreationPipeline);
    }

    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            processOutgoingChatMessage();
        });
    }

    if (chatInputTextArea) {
        chatInputTextArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                processOutgoingChatMessage();
            }
        });

        chatInputTextArea.addEventListener('input', () => {
            chatInputTextArea.style.height = 'auto';
            chatInputTextArea.style.height = (chatInputTextArea.scrollHeight) + 'px';
        });
    }

    if (fileUploadHiddenInput) {
        fileUploadHiddenInput.addEventListener('change', executeFileBinaryUploadPipeline);
    }

    if (toggleFilesButton && attachedFilesTrackerList) {
        toggleFilesButton.addEventListener('click', () => {
            attachedFilesTrackerList.classList.toggle('hidden');
            toggleFilesButton.classList.toggle('open');
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'auth.html';
        });
    }
});

// ============================================================================
// 3. CORE ROUTINES: SESSIONS MANAGEMENT
// ============================================================================
async function loadAllUserSessions() {
    try {
        const res = await fetch(`${API_URLS.getSessions(CURRENT_USER_ID)}?user_id=${CURRENT_USER_ID}`);
        if (!res.ok) throw new Error("Failed to pull session registry from backend.");
        
        const data = await res.json();
        
        if (sidebarSessionsContainer) sidebarSessionsContainer.innerHTML = '';
        
        if (!data || !data.sessions || data.sessions.length === 0) {
            if (sidebarSessionsContainer) {
                sidebarSessionsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 15px; text-align: center;">No active chats.<br>Click "New Chat" to begin!</div>';
            }
            if (chatWindowHistory) {
                chatWindowHistory.innerHTML = `
                    <div class="empty-state-prompt">
                        <i class="fa-solid fa-comments" style="font-size: 3rem; color: var(--accent); margin-bottom: 1rem;"></i>
                        <h3>Welcome to your Workspace</h3>
                        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">Create a session or select an existing line item to start testing.</p>
                    </div>`;
            }
            if (attachedFilesTrackerList) attachedFilesTrackerList.innerHTML = '<div class="file-item-empty">No active session selected</div>';
            currentActiveSessionId = null;
            return; 
        }

        data.sessions.forEach(session => {
            renderSessionItemInSidebar(session);
        });

        const initialSessionId = data.sessions[0].session_id || data.sessions[0][0];
        if (initialSessionId) {
            switchSessionContext(initialSessionId);
        }
    } catch (err) {
        console.error("Critical error inside loadAllUserSessions:", err);
        showToast("Error retrieving chat registries.", true);
    }
}

function renderSessionItemInSidebar(session) {
    if (!sidebarSessionsContainer) return;

    const sessionId = session.session_id || session[0];
    const rawTitle = session.title || session[2] || `Chat Session ${sessionId}`;

    const sessionRow = document.createElement('button');
    sessionRow.className = `session-item ${currentActiveSessionId === sessionId ? 'active' : ''}`;
    sessionRow.setAttribute('data-session-id', sessionId);
    sessionRow.style.width = "100%";
    sessionRow.style.justifyContent = "space-between";

    sessionRow.innerHTML = `
        <div class="session-title-wrapper" style="display: flex; align-items: center; gap: 0.75rem; overflow: hidden;">
            <i class="fa-regular fa-message"></i>
            <span class="session-title-text" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${rawTitle}</span>
        </div>
        <i class="fa-regular fa-trash-can delete-session-action-btn" title="Delete Session" style="cursor: pointer; padding: 4px; transition: color 0.2s;"></i>
    `;

    sessionRow.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-session-action-btn')) return;
        switchSessionContext(sessionId);
    });

    const binBtn = sessionRow.querySelector('.delete-session-action-btn');
    binBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        executeSessionDeletionPipeline(sessionId, sessionRow);
    });

    sidebarSessionsContainer.appendChild(sessionRow);
}

async function triggerSessionCreationPipeline() {
    try {
        const clientGeneratedSessionId = typeof crypto.randomUUID === 'function' 
            ? crypto.randomUUID() 
            : Math.random().toString(36).substring(2, 15);
            
        const targetUrl = `${API_URLS.createSession}?session_id=${clientGeneratedSessionId}&user_id=${CURRENT_USER_ID}&title=${encodeURIComponent("New Chat")}`;

        const res = await fetch(targetUrl, { method: 'POST' });
        if (!res.ok) throw new Error("Could not construct new tracking thread context.");
        
        const data = await res.json();
        const generatedId = data.session_id;
        
        showToast("New chat thread deployed successfully.");
        await loadAllUserSessions();
        if (generatedId) switchSessionContext(generatedId);
    } catch (err) {
        console.error(err);
        showToast("Could not generate new session context.", true);
    }
}

async function executeSessionDeletionPipeline(sessionId, domNodeElement) {
    if (!confirm("Are you sure you want to permanently delete this chat session?")) return;

    try {
        const res = await fetch(API_URLS.deleteSession(sessionId), { method: 'DELETE' });
        if (!res.ok) throw new Error("Backend refused to drop target identifier.");
        
        domNodeElement.remove();
        showToast("Session successfully erased.");
        if (currentActiveSessionId === sessionId) {
            currentActiveSessionId = null;
            loadAllUserSessions();
        }
    } catch (e) {
        console.error(e);
        showToast("Failed to clear selected session context.", true);
    }
}

async function switchSessionContext(sessionId) {
    if (liveStreamAbortController) {
        liveStreamAbortController.abort();
    }

    currentActiveSessionId = sessionId;

    document.querySelectorAll('.session-item').forEach(el => {
        if (el.getAttribute('data-session-id') === String(sessionId)) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    if (chatWindowHistory) chatWindowHistory.innerHTML = '';

    try {
        const res = await fetch(`${API_URLS.getMessages(sessionId)}?user_id=${CURRENT_USER_ID}`);
        if (res.ok) {
            const data = await res.json();
            const messages = data.messages || data;
            if (Array.isArray(messages)) {
                messages.forEach(msg => {
                    const rawContent = msg.content || msg.text || "";
                    
                    if (rawContent.trim().startsWith('{') && rawContent.includes('"name"')) {
                        return; 
                    }

                    const isAi = msg.role === 'ai' || msg.role === 'assistant';
                    const finalContent = (isAi && typeof marked !== 'undefined') 
                        ? marked.parse(rawContent) 
                        : rawContent;

                    appendMessageContainerToUI(isAi ? 'ai' : 'user', finalContent);
                });
            }
        }
    } catch (e) {
        console.error("Error updating history view:", e);
    }

    refreshAttachedFilesInventoryTracker();
}

// ============================================================================
// 4. CORE ROUTINES: CHAT PIPELINE (STREAM PROCESSING)
// ============================================================================
async function processOutgoingChatMessage() {
    if (!currentActiveSessionId) {
        showToast("Please select or start a chat session first.", true);
        return;
    }

    if (!chatInputTextArea) return;
    const textualPrompt = chatInputTextArea.value.trim();
    if (!textualPrompt) return;

    appendMessageContainerToUI('user', textualPrompt);
    chatInputTextArea.value = '';
    chatInputTextArea.style.height = 'auto';

    const aiResponseDOMShell = appendMessageContainerToUI('ai', '<span class="typing-indicator"><i class="fa-solid fa-ellipsis fa-bounce"></i> Processing...</span>');
    const innerBubbleNode = aiResponseDOMShell.querySelector('.message-content');

    liveStreamAbortController = new AbortController();

    try {
        const requestPayload = {
            question: textualPrompt,
            session_id: String(currentActiveSessionId),
            user_id: String(CURRENT_USER_ID)
        };

        const responseStream = await fetch(API_URLS.streamChat(currentActiveSessionId), { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload),
            signal: liveStreamAbortController.signal
        });

        if (!responseStream.ok) throw new Error("Streaming handshake rejected by gateway.");

        const dataStreamReader = responseStream.body.getReader();
        const textDecoderTransformer = new TextDecoder();
        let aggregatedBufferString = "";
        let isFirstChunk = true;

        while (true) {
            const { value, done } = await dataStreamReader.read();
            if (done) break;

            const decryptedChunk = textDecoderTransformer.decode(value, { stream: true });
            aggregatedBufferString += decryptedChunk;

            if (isFirstChunk) {
                innerBubbleNode.innerHTML = "";
                isFirstChunk = false;
            }

            if (typeof marked !== 'undefined') {
                innerBubbleNode.innerHTML = marked.parse(aggregatedBufferString);
            } else {
                innerBubbleNode.textContent = aggregatedBufferString;
            }

            if (chatWindowHistory) {
                chatWindowHistory.scrollTop = chatWindowHistory.scrollHeight;
            }
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log("Active request stream closed by user context.");
        } else {
            console.error(err);
            if (innerBubbleNode) {
                innerBubbleNode.innerHTML = `<span style="color:var(--text-error)">Network stream processing failure.</span>`;
            }
        }
    } finally {
        liveStreamAbortController = null;
    }
}

function appendMessageContainerToUI(senderType, payloadString) {
    if (!chatWindowHistory) return null;

    const messageRowElement = document.createElement('div');
    messageRowElement.className = `message ${senderType}-message`;

    if (senderType === 'ai') {
        messageRowElement.innerHTML = `
            <div class="avatar ai-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content markdown-body">
                ${payloadString}
            </div>
        `;
    } else {
        messageRowElement.innerHTML = `
            <div class="message-content">
                ${payloadString}
            </div>
        `;
    }

    chatWindowHistory.appendChild(messageRowElement);
    chatWindowHistory.scrollTop = chatWindowHistory.scrollHeight;

    return messageRowElement;
}

// ============================================================================
// 5. CORE ROUTINES: DOCUMENT & FILE MANAGEMENT
// ============================================================================
async function refreshAttachedFilesInventoryTracker() {
    if (!attachedFilesTrackerList) return;
    if (!currentActiveSessionId) {
        attachedFilesTrackerList.innerHTML = '<div class="file-item-empty">No active session selected</div>';
        return;
    }

    try {
        const res = await fetch(API_URLS.getFiles(currentActiveSessionId)); 
        if (!res.ok) throw new Error("Could not pull dynamic session asset indices.");
        
        const data = await res.json();
        attachedFilesTrackerList.innerHTML = '';

        const assets = data.sessions; 

        if (Array.isArray(assets) && assets.length > 0) {
            assets.forEach(asset => {
                const name = typeof asset === 'string' ? asset : (asset.file_name || asset[2]);
                if (!name) return;

                const fileItemRow = document.createElement('div');
                fileItemRow.className = 'file-item';
                fileItemRow.innerHTML = `
                    <i class="fa-regular fa-file-lines"></i>
                    <span class="file-name" title="${name}">${name}</span>
                    <button type="button" class="delete-file-btn" title="Remove Document">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                `;

                fileItemRow.querySelector('.delete-file-btn').addEventListener('click', () => {
                    executeFileDeletionPipeline(name);
                });

                attachedFilesTrackerList.appendChild(fileItemRow);
            });
        } else {
            attachedFilesTrackerList.innerHTML = '<div class="file-item-empty">No files attached to this thread context.</div>';
        }
    } catch (err) {
        console.error("Error drawing files registry visual tracking elements:", err);
        attachedFilesTrackerList.innerHTML = '<div class="file-item-empty" style="color:var(--text-error)">Asset inventory tracking failure.</div>';
    }
}

async function executeFileBinaryUploadPipeline() {
    if (!currentActiveSessionId) {
        showToast("Please open an explicit active session before targeting document ingestion.", true);
        fileUploadHiddenInput.value = '';
        return;
    }

    const selectedFileHandle = fileUploadHiddenInput.files[0];
    if (!selectedFileHandle) return;

    if (attachedFilesTrackerList) {
        attachedFilesTrackerList.classList.remove('hidden');
        if (toggleFilesButton) toggleFilesButton.classList.add('open');
        attachedFilesTrackerList.innerHTML = `<div class="file-item loading"><i class="fa-solid fa-spinner fa-spin"></i> Processing and uploading "${selectedFileHandle.name}"...</div>`;
    }

    const multiPartFormPayload = new FormData();
    multiPartFormPayload.append('session_id', currentActiveSessionId);
    multiPartFormPayload.append('file', selectedFileHandle);

    try {
        const res = await fetch(API_URLS.uploadFile, { 
            method: 'POST',
            body: multiPartFormPayload
        });

        if (!res.ok) throw new Error("File server rejected binary parsing transaction.");
        
        showToast("Document asset ingested and vectorized successfully.");
        fileUploadHiddenInput.value = '';
        refreshAttachedFilesInventoryTracker();
    } catch (err) {
        console.error(err);
        showToast("Document uploading operation failed.", true);
        fileUploadHiddenInput.value = '';
        refreshAttachedFilesInventoryTracker();
    }
}

async function executeFileDeletionPipeline(fileName) {
    if (!confirm(`Remove "${fileName}" from this conversation pipeline?`)) return;

    try {
        const targetUrl = `${API_URLS.deleteFile}?session_id=${currentActiveSessionId}&file_name=${encodeURIComponent(fileName)}`;
        
        const res = await fetch(targetUrl, { method: 'DELETE' });

        if (!res.ok) throw new Error("Server refused deletion request processing.");
        
        showToast("Document cleanly unlinked.");
        refreshAttachedFilesInventoryTracker();
    } catch (e) {
        console.error(e);
        showToast("Failed to drop selected document asset tracking index.", true);
    }
}

// ============================================================================
// 6. FLOATING TOAST SYSTEM
// ============================================================================
function showToast(message, isError = false) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeftColor = isError ? 'var(--text-error)' : 'var(--accent)';
    toast.innerHTML = isError 
        ? `<i class="fa-solid fa-circle-exclamation"></i> ${message}`
        : `<i class="fa-solid fa-circle-check"></i> ${message}`;
    toastContainer.appendChild(toast);
    
    setTimeout(() => toast.remove(), 5000);
}