/* --- STATE MANAGEMENT --- */
const STATE = {
    currentRoomId: null,
    user: {
        id: null,
        name: "Anonymous",
        avatar: "https://placehold.co/150x150/4f46e5/ffffff?text=U",
        bio: "Available"
    },
    unsubscribe: null, // Fixed missing comma
    rooms: {}, 
    replyTo: null, 
    selectionMode: false,
    selectedMsgs: new Set(),
    themes: ["midnight", "pastel-blue", "pastel-pink", "sage-green"],
    themeIdx: 0,
    contextTargetId: null 
};

// HTML STRING FOR EMPTY STATE
const EMPTY_STATE_HTML = `
<div id="empty-state" class="empty-state">
    <ion-icon name="chatbubbles-outline"></ion-icon>
    <p>Create or Join a room using a Code.</p>
</div>
`;

/* --- DOM ELEMENTS --- */
const UI = {
    app: document.getElementById('app-container'),
    sidebar: document.getElementById('sidebar'),
    roomList: document.getElementById('room-list'),
    msgsList: document.getElementById('messages-list'),
    msgInput: document.getElementById('msg-input'),
    joinInput: document.getElementById('join-input'),
    imgInput: document.getElementById('img-upload-input'),
    sendBtn: document.getElementById('send-btn'),
    createBtn: document.getElementById('create-room-btn'),
    joinBtn: document.getElementById('join-btn'),
    mobileBack: document.getElementById('mobile-back'),
    themeBtn: document.getElementById('theme-toggle'),
    codeBtn: document.getElementById('code-btn'),
    imgBtn: document.getElementById('img-btn'),
    emojiBtn: document.getElementById('emoji-btn'),
    scrollDownBtn: document.getElementById('scroll-down-btn'),
    contextMenu: document.getElementById('context-menu'),
    ctxRename: document.getElementById('ctx-rename'),
    ctxDelete: document.getElementById('ctx-delete'),
    deleteToggle: document.getElementById('delete-toggle'),
    confirmDelete: document.getElementById('confirm-delete'),
    headerTitle: document.getElementById('header-title'),
    headerStatus: document.getElementById('header-status'),
    profileMini: document.getElementById('profile-mini-btn'),
    miniAvatar: document.getElementById('mini-avatar'),
    miniName: document.getElementById('mini-name'),
    modal: document.getElementById('profile-modal'),
    closeModal: document.getElementById('close-profile'),
    saveProfile: document.getElementById('save-profile-btn'),
    modalAvatarInput: document.getElementById('modal-avatar-input'),
    changeAvatarBtn: document.getElementById('change-avatar-btn'),
    modalNameInput: document.getElementById('modal-name-input'),
    replyBanner: document.getElementById('reply-banner'),
    cancelReply: document.getElementById('cancel-reply'),
    replyTarget: document.getElementById('reply-target'),
    notice: document.getElementById('input-notice')
};

/* --- INIT --- */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial UI Setup
    setupEvents();
    UI.msgsList.innerHTML = EMPTY_STATE_HTML;

    // 2. Auth Logic
    auth.signInAnonymously().catch(err => console.error("Auth Error:", err));

    auth.onAuthStateChanged((user) => {
        if (user) {
            STATE.user.id = user.uid;
            
            // Load Profile
            const hasProfile = localStorage.getItem('delta_profile');
            if (hasProfile) {
                loadProfile();
            } else {
                UI.modal.classList.remove('hidden');
                UI.closeModal.style.display = 'none';
            }

            // Load Rooms
            loadRooms();
            if(Object.keys(STATE.rooms).length === 0) {
                UI.roomList.innerHTML = `<div style="padding:20px; text-align:center; color:#94a3b8; font-size:0.8rem;">No rooms found.<br>Create one to start!</div>`;
            } else {
                renderRoomList();
            }
        }
    });
});

/* --- EVENT LISTENERS --- */
function setupEvents() {
    UI.createBtn.onclick = () => {
        const roomId = 'ROOM-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        addRoom(roomId, roomId); 
    };

    UI.joinBtn.onclick = () => {
        const code = UI.joinInput.value.trim().toUpperCase();
        if(code) { addRoom(code, code); UI.joinInput.value = ''; }
    };

    UI.msgInput.oninput = () => UI.sendBtn.disabled = UI.msgInput.value.trim().length === 0;
    UI.msgInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
    UI.sendBtn.onclick = sendMessage;

    UI.msgsList.onscroll = () => {
        const dist = UI.msgsList.scrollHeight - UI.msgsList.scrollTop - UI.msgsList.clientHeight;
        dist > 150 ? UI.scrollDownBtn.classList.add('visible') : UI.scrollDownBtn.classList.remove('visible');
    };

    UI.scrollDownBtn.onclick = scrollToBottom;
    document.onclick = () => UI.contextMenu.classList.add('hidden');
    
    UI.ctxRename.onclick = () => {
        const id = STATE.contextTargetId;
        const newName = prompt("Rename Room:", STATE.rooms[id]);
        if(newName?.trim()) { STATE.rooms[id] = newName.trim(); saveRooms(); renderRoomList(); }
    };

    UI.ctxDelete.onclick = () => {
        const id = STATE.contextTargetId;
        if(confirm(`Delete "${STATE.rooms[id]}"?`)) {
            delete STATE.rooms[id];
            saveRooms();
            renderRoomList();
            if(STATE.currentRoomId === id) {
                UI.app.classList.remove('chat-active');
                STATE.currentRoomId = null;
                UI.msgsList.innerHTML = EMPTY_STATE_HTML;
            }
        }
    };

    UI.codeBtn.onclick = () => { UI.msgInput.value += " ```\ncode\n``` "; UI.msgInput.focus(); };
    UI.imgBtn.onclick = () => UI.imgInput.click();
    UI.imgInput.onchange = (e) => { if(e.target.files[0]) sendImageMessage(e.target.files[0]); };
    UI.mobileBack.onclick = () => { UI.app.classList.remove('chat-active'); if(STATE.unsubscribe) STATE.unsubscribe(); };
    UI.themeBtn.onclick = cycleTheme;
    UI.deleteToggle.onclick = toggleDeleteMode;
    UI.confirmDelete.onclick = deleteSelectedMessages;
    UI.profileMini.onclick = openProfileModal;
    UI.closeModal.onclick = () => UI.modal.classList.add('hidden');
    UI.saveProfile.onclick = saveProfile;
    UI.changeAvatarBtn.onclick = () => UI.modalAvatarInput.click();
    UI.modalAvatarInput.onchange = (e) => {
        const file = e.target.files[0];
        if(file) {
            const reader = new FileReader();
            reader.onload = (evt) => document.getElementById('modal-avatar-preview').src = evt.target.result;
            reader.readAsDataURL(file);
        }
    };
    UI.cancelReply.onclick = () => { STATE.replyTo = null; UI.replyBanner.classList.add('hidden'); };
}

/* --- ROOMS --- */
function loadRooms() { STATE.rooms = JSON.parse(localStorage.getItem('delta_rooms') || '{}'); }
function saveRooms() { localStorage.setItem('delta_rooms', JSON.stringify(STATE.rooms)); }

function addRoom(id, name) {
    if(!STATE.rooms[id]) { STATE.rooms[id] = name; saveRooms(); renderRoomList(); }
    enterRoom(id);
}

function renderRoomList() {
    UI.roomList.innerHTML = '';
    Object.entries(STATE.rooms).forEach(([id, name]) => {
        const el = document.createElement('div');
        el.className = `room-item ${STATE.currentRoomId === id ? 'active' : ''}`;
        el.innerHTML = `<div><span># ${escapeHtml(name)}</span><div style="font-size:0.65rem; opacity:0.5;">ID: ${id}</div></div><ion-icon name="chevron-forward"></ion-icon>`;
        el.onclick = () => enterRoom(id);
        el.oncontextmenu = (e) => {
            e.preventDefault();
            STATE.contextTargetId = id;
            UI.contextMenu.style.left = `${e.clientX}px`; UI.contextMenu.style.top = `${e.clientY}px`;
            UI.contextMenu.classList.remove('hidden');
        };
        UI.roomList.appendChild(el);
    });
}

function enterRoom(id) {
    STATE.currentRoomId = id;
    UI.headerTitle.innerText = STATE.rooms[id];
    UI.app.classList.add('chat-active');
    if (STATE.unsubscribe) STATE.unsubscribe();
    UI.msgsList.innerHTML = '';

    STATE.unsubscribe = db.collection('messages')
        .where('roomId', '==', id)
        .orderBy('timestamp', 'asc')
        .onSnapshot(snap => {
            snap.docChanges().forEach(change => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    data.id = change.doc.id;
                    renderSingleMessage(data);
                    scrollToBottom();
                }
            });
            if(snap.empty) UI.msgsList.innerHTML = EMPTY_STATE_HTML;
        });
    renderRoomList();
}

/* --- MESSAGES --- */
function renderSingleMessage(msg) {
    const isMine = msg.uid === STATE.user.id;
    const div = document.createElement('div');
    div.className = `message-group ${isMine ? 'mine' : 'theirs'}`;
    div.id = `msg-${msg.id}`;

    let replyHTML = msg.replyTo ? `<div class="reply-snippet"><ion-icon name="return-up-back"></ion-icon><span>${msg.replyTo.user}: ${msg.replyTo.text.substring(0,20)}...</span></div>` : '';
    let contentHTML = msg.type === 'image' ? `<img src="${msg.text}" class="msg-img" onclick="window.open(this.src)">` : formatText(msg.text);

    div.innerHTML = `
        <div class="select-box" onclick="toggleSelectMsg('${msg.id}')"></div>
        <div class="bubble-wrapper">
            ${replyHTML}<div class="bubble">${contentHTML}</div>
            <div class="msg-meta">${msg.userName} • ${msg.time}</div>
        </div>
        <button class="reply-btn-hover" onclick="initReply('${msg.id}', '${msg.userName}', '${msg.text.replace(/'/g, "\\'")}')"><ion-icon name="arrow-undo"></ion-icon></button>
    `;
    UI.msgsList.appendChild(div);
}

function sendMessage() {
    const text = UI.msgInput.value.trim();
    if(!STATE.currentRoomId || !text) return;
    
    db.collection('messages').add({
        roomId: STATE.currentRoomId,
        uid: STATE.user.id,
        userName: STATE.user.name,
        text: text,
        type: 'text',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        replyTo: STATE.replyTo
    });

    UI.msgInput.value = '';
    STATE.replyTo = null;
    UI.replyBanner.classList.add('hidden');
}

function sendImageMessage(file) {
    const ref = storage.ref(`images/${STATE.currentRoomId}/${Date.now()}`);
    ref.put(file).then(() => ref.getDownloadURL()).then(url => {
        db.collection('messages').add({
            roomId: STATE.currentRoomId, uid: STATE.user.id, userName: STATE.user.name,
            text: url, type: 'image', timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
        });
    });
}

function initReply(id, user, text) {
    STATE.replyTo = { id, user, text };
    UI.replyBanner.classList.remove('hidden');
    UI.replyTarget.innerText = user;
    UI.msgInput.focus();
}

/* --- DELETION --- */
function toggleDeleteMode() {
    STATE.selectionMode = !STATE.selectionMode;
    UI.msgsList.classList.toggle('selection-mode', STATE.selectionMode);
    UI.deleteToggle.innerHTML = STATE.selectionMode ? '<ion-icon name="close-circle"></ion-icon>' : '<ion-icon name="trash-outline"></ion-icon>';
    UI.confirmDelete.classList.toggle('hidden', !STATE.selectionMode);
}

window.toggleSelectMsg = (id) => {
    const el = document.getElementById(`msg-${id}`);
    STATE.selectedMsgs.has(id) ? STATE.selectedMsgs.delete(id) : STATE.selectedMsgs.add(id);
    el.classList.toggle('selected');
};

function deleteSelectedMessages() {
    STATE.selectedMsgs.forEach(id => db.collection('messages').doc(id).delete());
    exitDeleteMode();
}

function exitDeleteMode() {
    STATE.selectionMode = false;
    STATE.selectedMsgs.clear();
    UI.msgsList.classList.remove('selection-mode');
    UI.confirmDelete.classList.add('hidden');
}

/* --- PROFILE --- */
function loadProfile() {
    const saved = JSON.parse(localStorage.getItem('delta_profile') || '{}');
    STATE.user = { ...STATE.user, ...saved };
    updateProfileUI();
}

function updateProfileUI() {
    UI.miniName.innerText = STATE.user.name;
    UI.miniAvatar.src = STATE.user.avatar;
    UI.modalNameInput.value = STATE.user.name;
    document.getElementById('modal-bio-input').value = STATE.user.bio;
}

function openProfileModal() { UI.modal.classList.remove('hidden'); updateProfileUI(); }

function saveProfile() {
    STATE.user.name = UI.modalNameInput.value.trim() || "Anonymous";
    STATE.user.bio = document.getElementById('modal-bio-input').value.trim();
    STATE.user.avatar = document.getElementById('modal-avatar-preview').src;
    localStorage.setItem('delta_profile', JSON.stringify(STATE.user));
    UI.closeModal.style.display = 'block'; UI.modal.classList.add('hidden');
    updateProfileUI();
}

/* --- UTILS --- */
function formatText(t) {
    let s = escapeHtml(t);
    s = s.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    return s.replace(CONFIG.URL_REGEX, u => `<a href="${u}" target="_blank" class="msg-link">${u}</a>`);
}

function escapeHtml(t) { return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ""; }
function scrollToBottom() { UI.msgsList.scrollTo({ top: UI.msgsList.scrollHeight, behavior: 'smooth' }); }
function flashNotice(t) { UI.notice.innerText = t; UI.notice.classList.add('visible'); setTimeout(() => UI.notice.classList.remove('visible'), 2000); }
function cycleTheme() { STATE.themeIdx = (STATE.themeIdx + 1) % STATE.themes.length; document.body.setAttribute('data-theme', STATE.themes[STATE.themeIdx]); }
