/* --- STATE MANAGEMENT --- */
const STATE = {
    currentRoomId: null,
    user: {
        id: null,
        name: "Anonymous",
        avatar: "https://placehold.co/150x150/4f46e5/ffffff?text=U",
        bio: "Available"
    },
    unsubscribe: null
    rooms: {}, 
    replyTo: null, 
    selectionMode: false,
    selectedMsgs: new Set(),
    themes: ["midnight", "pastel-blue", "pastel-pink", "sage-green"],
    themeIdx: 0,
    contextTargetId: null // Stores the ID of room being right-clicked
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
    
    // Inputs
    msgInput: document.getElementById('msg-input'),
    joinInput: document.getElementById('join-input'),
    imgInput: document.getElementById('img-upload-input'),
    
    // Buttons
    sendBtn: document.getElementById('send-btn'),
    createBtn: document.getElementById('create-room-btn'),
    joinBtn: document.getElementById('join-btn'),
    mobileBack: document.getElementById('mobile-back'),
    themeBtn: document.getElementById('theme-toggle'),
    codeBtn: document.getElementById('code-btn'),
    imgBtn: document.getElementById('img-btn'),
    emojiBtn: document.getElementById('emoji-btn'),
    scrollDownBtn: document.getElementById('scroll-down-btn'),
    
    // Context Menu
    contextMenu: document.getElementById('context-menu'),
    ctxRename: document.getElementById('ctx-rename'),
    ctxDelete: document.getElementById('ctx-delete'),

    // Deletion
    deleteToggle: document.getElementById('delete-toggle'),
    confirmDelete: document.getElementById('confirm-delete'),
    
    // Headers/Status
    headerTitle: document.getElementById('header-title'),
    headerStatus: document.getElementById('header-status'),
    
    // Profile
    profileMini: document.getElementById('profile-mini-btn'),
    miniAvatar: document.getElementById('mini-avatar'),
    miniName: document.getElementById('mini-name'),
    modal: document.getElementById('profile-modal'),
    closeModal: document.getElementById('close-profile'),
    saveProfile: document.getElementById('save-profile-btn'),
    modalAvatarInput: document.getElementById('modal-avatar-input'),
    changeAvatarBtn: document.getElementById('change-avatar-btn'),
    modalNameInput: document.getElementById('modal-name-input'),
    
    // Reply
    replyBanner: document.getElementById('reply-banner'),
    cancelReply: document.getElementById('cancel-reply'),
    replyTarget: document.getElementById('reply-target'),
    notice: document.getElementById('input-notice')
};

/* --- INIT --- */
document.addEventListener('DOMContentLoaded', () => {
    // Sign in anonymously silently
    auth.signInAnonymously().catch((error) => {
        console.error("Auth Error", error);
    });

    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
        if (user) {
            STATE.user.id = user.uid;
            
            // Check if we have a saved profile in Firestore (Optional, or keep localStorage for profile)
            const localProfile = localStorage.getItem('delta_profile');
            if (localProfile) {
                const parsed = JSON.parse(localProfile);
                STATE.user.name = parsed.name;
                STATE.user.avatar = parsed.avatar;
                updateProfileUI();
            }
            
            loadRooms(); // Keep this from localStorage for now (My Saved Rooms)
            renderRoomList();
        }
    });

    setupEvents();
});

    // 2. Load Rooms
    loadRooms();
    if(Object.keys(STATE.rooms).length === 0) {
        UI.roomList.innerHTML = `<div style="padding:20px; text-align:center; color:#94a3b8; font-size:0.8rem;">No rooms found.<br>Create one to start!</div>`;
    } else {
        renderRoomList();
    }

    setupEvents();
    
    if(!localStorage.getItem('delta_uid')) localStorage.setItem('delta_uid', STATE.user.id);
    
    UI.msgsList.innerHTML = EMPTY_STATE_HTML;
});

/* --- EVENT LISTENERS --- */
function setupEvents() {
    
    // 1. Room Creation & Joining
    UI.createBtn.onclick = () => {
        const roomId = 'ROOM-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        addRoom(roomId, roomId); 
    };

    UI.joinBtn.onclick = () => {
        const code = UI.joinInput.value.trim().toUpperCase();
        if(code) {
            addRoom(code, code);
            UI.joinInput.value = '';
        }
    };

    // 2. Messaging
    UI.msgInput.addEventListener('input', () => {
        UI.sendBtn.disabled = UI.msgInput.value.trim().length === 0;
    });

    UI.msgInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });
    
    UI.sendBtn.onclick = sendMessage;

    // 3. Scroll Logic
    UI.msgsList.addEventListener('scroll', () => {
        // Show scroll button if we are more than 150px from bottom
        const distanceToBottom = UI.msgsList.scrollHeight - UI.msgsList.scrollTop - UI.msgsList.clientHeight;
        if(distanceToBottom > 150) {
            UI.scrollDownBtn.classList.add('visible');
        } else {
            UI.scrollDownBtn.classList.remove('visible');
        }
    });

    UI.scrollDownBtn.onclick = scrollToBottom;

    // 4. Context Menu Logic (Right Click)
    document.addEventListener('click', () => UI.contextMenu.classList.add('hidden')); // Close on click anywhere
    
    UI.ctxRename.onclick = () => {
        const id = STATE.contextTargetId;
        const currentName = STATE.rooms[id];
        const newName = prompt("Rename Room:", currentName);
        if(newName && newName.trim()) {
            STATE.rooms[id] = newName.trim();
            saveRooms();
            renderRoomList();
        }
        UI.contextMenu.classList.add('hidden');
    };

    UI.ctxDelete.onclick = () => {
        const id = STATE.contextTargetId;
        if(confirm(`Are you sure you want to delete "${STATE.rooms[id]}"? This will hide it from your list.`)) {
            delete STATE.rooms[id];
            saveRooms();
            renderRoomList();
            if(STATE.currentRoomId === id) {
                // If we deleted the active room, reset view
                UI.app.classList.remove('chat-active');
                STATE.currentRoomId = null;
                UI.msgsList.innerHTML = EMPTY_STATE_HTML;
                UI.headerTitle.innerText = "Select a Room";
            }
        }
        UI.contextMenu.classList.add('hidden');
    };

    // 5. Media & Tools
    UI.codeBtn.onclick = () => {
        UI.msgInput.value += " ```\ncode\n``` ";
        UI.msgInput.focus();
    };
    
    UI.emojiBtn.onclick = () => {
        UI.msgInput.focus(); 
        flashNotice("Use your keyboard's emoji picker.");
    };

    UI.imgBtn.onclick = () => UI.imgInput.click();
    UI.imgInput.onchange = (e) => {
        const file = e.target.files[0];
        if(file) {
            const reader = new FileReader();
            reader.onload = (evt) => sendImageMessage(evt.target.result);
            reader.readAsDataURL(file);
        }
        UI.imgInput.value = '';
    };

    // 6. Navigation
    UI.mobileBack.onclick = () => {
        UI.app.classList.remove('chat-active');
        STATE.currentRoomId = null;
    };
    UI.themeBtn.onclick = cycleTheme;

    // 7. Deletion Mode
    UI.deleteToggle.onclick = toggleDeleteMode;
    UI.confirmDelete.onclick = deleteSelectedMessages;

    // 8. Profile Modal
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
    
    UI.cancelReply.onclick = () => {
        STATE.replyTo = null;
        UI.replyBanner.classList.add('hidden');
    };
}

/* --- ROOM LOGIC --- */
function loadRooms() {
    const raw = localStorage.getItem('delta_rooms');
    STATE.rooms = raw ? JSON.parse(raw) : {};
}

function saveRooms() {
    localStorage.setItem('delta_rooms', JSON.stringify(STATE.rooms));
}

function addRoom(id, name) {
    if(!STATE.rooms[id]) {
        STATE.rooms[id] = name;
        saveRooms();
        renderRoomList();
    }
    enterRoom(id);
}

function renderRoomList() {
    UI.roomList.innerHTML = '';
    Object.entries(STATE.rooms).forEach(([id, name]) => {
        const el = document.createElement('div');
        el.className = `room-item ${STATE.currentRoomId === id ? 'active' : ''}`;
        el.innerHTML = `
            <div>
                <span># ${escapeHtml(name)}</span>
                <div style="font-size:0.65rem; opacity:0.5;">ID: ${id}</div>
            </div>
            <ion-icon name="chevron-forward"></ion-icon>
        `;
        el.onclick = () => enterRoom(id);
        
        // NEW: Right Click Logic
        el.oncontextmenu = (e) => {
            e.preventDefault();
            STATE.contextTargetId = id; // Remember which room was clicked
            
            // Position the menu at mouse coordinates
            UI.contextMenu.style.left = `${e.clientX}px`;
            UI.contextMenu.style.top = `${e.clientY}px`;
            UI.contextMenu.classList.remove('hidden');
        };
        
        UI.roomList.appendChild(el);
    });
}

function enterRoom(id) {
    STATE.currentRoomId = id;
    
    // UI Updates
    UI.headerTitle.innerText = `Room: ${id}`; // Or fetch room name from DB
    UI.app.classList.add('chat-active');
    
    // 1. Unsubscribe from previous room if exists
    if (STATE.unsubscribe) {
        STATE.unsubscribe();
    }

    UI.msgsList.innerHTML = ''; // Clear old messages

    // 2. Create Real-time Listener
    // Query: Collection 'messages', where room == id, order by time
    STATE.unsubscribe = db.collection('messages')
        .where('roomId', '==', id)
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const msgData = change.doc.data();
                    msgData.id = change.doc.id; // Use Firestore ID
                    renderSingleMessage(msgData); // Reuse your existing render function
                    scrollToBottom();
                }
                // You can handle 'modified' (edits) and 'removed' (deletes) here too
            });
            
            if(snapshot.empty) {
                UI.msgsList.innerHTML = EMPTY_STATE_HTML;
            }
        });
}

/* --- MESSAGE LOGIC --- */
function loadMessages() {
    const data = localStorage.getItem(`msgs_${STATE.currentRoomId}`);
    const msgs = data ? JSON.parse(data) : [];
    
    UI.msgsList.innerHTML = '';

    if(msgs.length === 0) {
        UI.msgsList.innerHTML = EMPTY_STATE_HTML;
        return;
    }

    msgs.forEach(msg => renderSingleMessage(msg));
    scrollToBottom();
}

function renderSingleMessage(msg) {
    const isMine = msg.uid === STATE.user.id;
    const div = document.createElement('div');
    div.className = `message-group ${isMine ? 'mine' : 'theirs'}`;
    div.id = `msg-${msg.id}`;

    let replyHTML = '';
    if(msg.replyTo) {
        replyHTML = `
        <div class="reply-snippet">
            <ion-icon name="return-up-back"></ion-icon>
            <span>${msg.replyTo.user}: ${msg.replyTo.text.substring(0,20)}...</span>
        </div>`;
    }

    let contentHTML = '';
    if(msg.type === 'image') {
        contentHTML = `<img src="${msg.text}" class="msg-img" onclick="window.open(this.src)">`;
    } else {
        contentHTML = formatText(msg.text); // NOW HANDLES LINKS
    }

    div.innerHTML = `
        <div class="select-box" onclick="toggleSelectMsg('${msg.id}')"></div>
        <div class="bubble-wrapper">
            ${replyHTML}
            <div class="bubble">${contentHTML}</div>
            <div class="msg-meta">${msg.userName} • ${msg.time}</div>
        </div>
        <button class="reply-btn-hover" onclick="initReply('${msg.id}', '${msg.userName}', '${msg.text.replace(/'/g, "\\'")}')">
            <ion-icon name="arrow-undo"></ion-icon>
        </button>
    `;

    // Swipe to Reply
    let touchStartX = 0;
    const bubbleWrapper = div.querySelector('.bubble-wrapper');
    bubbleWrapper.addEventListener('touchstart', e => touchStartX = e.changedTouches[0].screenX);
    bubbleWrapper.addEventListener('touchend', e => {
        if(STATE.selectionMode) return;
        const endX = e.changedTouches[0].screenX;
        if(endX - touchStartX > 80) initReply(msg.id, msg.userName, msg.text);
    });

    UI.msgsList.appendChild(div);
}

function sendMessage() {
    if(!STATE.currentRoomId || !UI.msgInput.value.trim()) return;
    
    const text = UI.msgInput.value.trim();
    
    // Prepare Data
    const msgPayload = {
        roomId: STATE.currentRoomId,
        uid: STATE.user.id,
        userName: STATE.user.name,
        text: text,
        type: 'text',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(), // Server time is crucial
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), // Display time
        replyTo: STATE.replyTo || null
    };

    // Send to Firestore
    db.collection('messages').add(msgPayload)
        .then(() => {
            console.log("Message Sent");
            UI.msgInput.value = '';
            UI.sendBtn.disabled = true;
            STATE.replyTo = null;
            UI.replyBanner.classList.add('hidden');
        })
        .catch((error) => console.error("Error sending:", error));
}

function sendImageMessage(fileObject) { 
    if(!STATE.currentRoomId) return;

    // Create a reference: images/roomId/timestamp.png
    const storageRef = storage.ref(`images/${STATE.currentRoomId}/${Date.now()}`);
    
    // Upload
    const uploadTask = storageRef.put(fileObject);

    uploadTask.on('state_changed', 
        (snapshot) => {
            // Optional: Update a progress bar here
            console.log("Uploading..."); 
        }, 
        (error) => {
            flashNotice("Upload Failed");
        }, 
        () => {
            // Upload complete, get the URL
            uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                // Save message with URL as text
                const msgPayload = {
                    roomId: STATE.currentRoomId,
                    uid: STATE.user.id,
                    userName: STATE.user.name,
                    text: downloadURL, // The URL goes here
                    type: 'image',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
                };
                
                db.collection('messages').add(msgPayload);
            });
        }
    );
}

// Update the Event Listener to pass the FILE object, not the FileReader result
UI.imgInput.onchange = (e) => {
    const file = e.target.files[0];
    if(file) sendImageMessage(file); // Pass the file directly
    UI.imgInput.value = '';
};

function saveAndRenderMsg(content, type) {
    const msg = {
        id: Date.now().toString(),
        uid: STATE.user.id,
        userName: STATE.user.name,
        text: content,
        type: type,
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        replyTo: STATE.replyTo
    };

    const key = `msgs_${STATE.currentRoomId}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    current.push(msg);
    localStorage.setItem(key, JSON.stringify(current));

    const emptyState = document.getElementById('empty-state');
    if(emptyState) emptyState.remove();

    renderSingleMessage(msg);
    scrollToBottom();
}

function initReply(id, user, text) {
    STATE.replyTo = { id, user, text };
    UI.replyBanner.classList.remove('hidden');
    UI.replyTarget.innerText = user;
    UI.msgInput.focus();
}

/* --- DELETION LOGIC --- */
function toggleDeleteMode() {
    STATE.selectionMode = !STATE.selectionMode;
    UI.msgsList.classList.toggle('selection-mode', STATE.selectionMode);
    
    if(STATE.selectionMode) {
        UI.deleteToggle.innerHTML = '<ion-icon name="close-circle"></ion-icon>';
        UI.confirmDelete.classList.remove('hidden');
        flashNotice("Select messages to delete");
    } else {
        exitDeleteMode();
    }
}

function exitDeleteMode() {
    STATE.selectionMode = false;
    STATE.selectedMsgs.clear();
    UI.msgsList.classList.remove('selection-mode');
    UI.deleteToggle.innerHTML = '<ion-icon name="trash-outline"></ion-icon>';
    UI.confirmDelete.classList.add('hidden');
    document.querySelectorAll('.message-group.selected').forEach(el => el.classList.remove('selected'));
}

window.toggleSelectMsg = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if(STATE.selectedMsgs.has(id)) {
        STATE.selectedMsgs.delete(id);
        el.classList.remove('selected');
    } else {
        STATE.selectedMsgs.add(id);
        el.classList.add('selected');
    }
};

function deleteSelectedMessages() {
    if(STATE.selectedMsgs.size === 0) return;
    const key = `msgs_${STATE.currentRoomId}`;
    let msgs = JSON.parse(localStorage.getItem(key) || '[]');
    msgs = msgs.filter(m => !STATE.selectedMsgs.has(m.id));
    localStorage.setItem(key, JSON.stringify(msgs));
    exitDeleteMode();
    loadMessages();
    flashNotice("Messages deleted");
}

/* --- PROFILE LOGIC --- */
function loadProfile() {
    const saved = localStorage.getItem('delta_profile');
    if(saved) STATE.user = { ...STATE.user, ...JSON.parse(saved) };
    updateProfileUI();
}

function updateProfileUI() {
    UI.miniName.innerText = STATE.user.name;
    UI.miniAvatar.src = STATE.user.avatar;
    document.getElementById('modal-avatar-preview').src = STATE.user.avatar;
    UI.modalNameInput.value = STATE.user.name;
    document.getElementById('modal-bio-input').value = STATE.user.bio;
}

function openProfileModal() {
    UI.modal.classList.remove('hidden');
    updateProfileUI();
}

function saveProfile() {
    const name = UI.modalNameInput.value.trim();
    const bio = document.getElementById('modal-bio-input').value.trim();
    const imgSrc = document.getElementById('modal-avatar-preview').src;

    if(!name) {
        alert("Display Name is mandatory!");
        return;
    }

    if(name) STATE.user.name = name;
    STATE.user.bio = bio;
    STATE.user.avatar = imgSrc;

    localStorage.setItem('delta_profile', JSON.stringify(STATE.user));
    
    // Unlock UI after save
    UI.closeModal.style.display = 'block'; 
    UI.modal.classList.add('hidden');
    
    updateProfileUI();
    flashNotice("Profile Updated");
}

/* --- UTILS --- */
function formatText(text) {
    let safe = escapeHtml(text);
    
    // 1. Code Blocks
    safe = safe.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // 2. Clickable Links (Regex from Config or standard)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    safe = safe.replace(urlRegex, function(url) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="msg-link">${url}</a>`;
    });

    return safe;
}

function escapeHtml(text) {
    // Safety check: if text is null or undefined, return an empty string
    if (!text) return ""; 
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function scrollToBottom() {
    UI.msgsList.scrollTo({
        top: UI.msgsList.scrollHeight,
        behavior: 'smooth'
    });
}

function flashNotice(text) {
    UI.notice.innerText = text;
    UI.notice.classList.add('visible');
    setTimeout(() => UI.notice.classList.remove('visible'), 2000);
}

function cycleTheme() {
    STATE.themeIdx = (STATE.themeIdx + 1) % STATE.themes.length;
    document.body.setAttribute('data-theme', STATE.themes[STATE.themeIdx]);
}