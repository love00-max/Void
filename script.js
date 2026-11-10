let peer = null;
let connections = {}; 
let hostConn = null;  
let isHost = false;
let myName = "";
let roomCode = "";

let players = []; 

// DOM Элементүүд
const loginSection = document.getElementById('login-section');
const joinModal = document.getElementById('join-modal');
const lobbySection = document.getElementById('lobby-section');
const gameSection = document.getElementById('game-section');

const usernameInput = document.getElementById('username-input');
const roomCodeInput = document.getElementById('room-code-input');
const roomInfo = document.getElementById('room-info');
const playerList = document.getElementById('player-list');
const playerCount = document.getElementById('player-count');

const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomModalBtn = document.getElementById('join-room-modal-btn');
const connectBtn = document.getElementById('connect-btn');
const backBtn = document.getElementById('back-btn');
const readyBtn = document.getElementById('ready-btn');
const startGameBtn = document.getElementById('start-game-btn');
const sendChatBtn = document.getElementById('send-chat-btn');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

// Хуудас ачаалагдахад өмнө нь хадгалсан нэр байвал оруулах
window.addEventListener('DOMContentLoaded', () => {
    const savedName = localStorage.getItem('tsagdaa_username');
    if (savedName && usernameInput) {
        usernameInput.value = savedName;
    }
});

// Өрөө үүсгэх (HOST)
createRoomBtn.addEventListener('click', () => {
    myName = usernameInput.value.trim();
    if (!myName) return alert('Нэрээ оруулна уу!');
    localStorage.setItem('tsagdaa_username', myName);

    isHost = true;
    peer = new Peer(); 

    peer.on('open', (id) => {
        roomCode = id;
        players.push({ id: peer.id, name: myName, ready: false });
        
        loginSection.classList.add('hidden');
        lobbySection.classList.remove('hidden');
        roomInfo.innerHTML = `Өрөөний код: <b>${roomCode}</b><br><small>(Найзууддаа энэ кодыг илгээгээрэй)</small>`;
        startGameBtn.classList.remove('hidden');
        updateLobbyUI();
    });

    peer.on('connection', (conn) => {
        conn.on('data', (data) => handleHostMessage(conn, data));
        conn.on('close', () => {
            players = players.filter(p => p.id !== conn.peer);
            delete connections[conn.peer];
            broadcastState();
            updateLobbyUI();
        });
    });
});

// Өрөөнд орох модал нээх
joinRoomModalBtn.addEventListener('click', () => {
    myName = usernameInput.value.trim();
    if (!myName) return alert('Нэрээ оруулна уу!');
    localStorage.setItem('tsagdaa_username', myName);
    
    loginSection.classList.add('hidden');
    joinModal.classList.remove('hidden');
});

backBtn.addEventListener('click', () => {
    joinModal.classList.add('hidden');
    loginSection.classList.remove('hidden');
});

// Холбогдох (CLIENT)
connectBtn.addEventListener('click', () => {
    const targetCode = roomCodeInput.value.trim();
    if (!targetCode) return alert('Өрөөний кодыг оруулна уу!');

    peer = new Peer();
    peer.on('open', () => {
        hostConn = peer.connect(targetCode);

        hostConn.on('open', () => {
            hostConn.send({ type: 'JOIN', name: myName });
            joinModal.classList.add('hidden');
            lobbySection.classList.remove('hidden');
        });

        hostConn.on('data', (data) => handleClientMessage(data));
        
        hostConn.on('close', () => {
            alert('Өрөө хаагдсан эсвэл холболт тасарлаа!');
            location.reload();
        });
    });
});

// HOST дээр ирэх мессеж боловсруулах
function handleHostMessage(conn, data) {
    if (data.type === 'JOIN') {
        connections[conn.peer] = conn;
        players.push({ id: conn.peer, name: data.name, ready: false });
        broadcastState();
        updateLobbyUI();
    } else if (data.type === 'TOGGLE_READY') {
        const p = players.find(player => player.id === conn.peer);
        if (p) p.ready = !p.ready;
        broadcastState();
        updateLobbyUI();
    } else if (data.type === 'CHAT') {
        broadcastMessage(data);
        addChatMessage(data.sender, data.text);
    }
}

// CLIENT дээр ирэх мессеж боловсруулах
function handleClientMessage(data) {
    if (data.type === 'STATE_UPDATE') {
        players = data.players;
        updateLobbyUI();
    } else if (data.type === 'CHAT') {
        addChatMessage(data.sender, data.text);
    } else if (data.type === 'START_GAME') {
        lobbySection.classList.add('hidden');
        gameSection.classList.remove('hidden');
        document.getElementById('role-display').innerText = `Таны дүр: ${data.roles[peer.id]}`;
    }
}

// Бүх тоглогч руу одоогийн төлөвийг илгээх (HOST)
function broadcastState() {
    const payload = { type: 'STATE_UPDATE', players };
    Object.values(connections).forEach(conn => conn.send(payload));
}

function broadcastMessage(data) {
    Object.values(connections).forEach(conn => conn.send(data));
}

// Лоббины UI шинэчлэх
function updateLobbyUI() {
    playerList.innerHTML = '';
    playerCount.innerText = players.length;

    players.forEach(p => {
        const li = document.createElement('li');
        const badge = p.ready 
            ? '<span class="ready-badge">✔ Бэлэн</span>' 
            : '<span class="not-ready-badge">✖ Хүлээж байна</span>';
        li.innerHTML = `<span>${p.name}</span> ${badge}`;
        playerList.appendChild(li);
    });
}

// READY товч
readyBtn.addEventListener('click', () => {
    if (isHost) {
        const p = players.find(player => player.id === peer.id);
        if (p) p.ready = !p.ready;
        broadcastState();
        updateLobbyUI();
    } else if (hostConn) {
        hostConn.send({ type: 'TOGGLE_READY' });
    }
});

// Тоглоом эхлүүлэх (зөвхөн HOST)
startGameBtn.addEventListener('click', () => {
    if (players.length < 2) return alert('Хамгийн багадаа 2 тоглогчтой эхэлнэ!');
    
    const roles = {};
    const policeIndex = Math.floor(Math.random() * players.length);
    players.forEach((p, idx) => {
        roles[p.id] = (idx === policeIndex) ? "👮‍♂️ ЦАГДАА" : "🕵️‍♂️ ХУЛГАЙЧ";
    });

    const payload = { type: 'START_GAME', roles };
    Object.values(connections).forEach(conn => conn.send(payload));
    
    lobbySection.classList.add('hidden');
    gameSection.classList.remove('hidden');
    document.getElementById('role-display').innerText = `Таны дүр: ${roles[peer.id]}`;
});

// Чат илгээх
sendChatBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(); });

function sendChat() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    const msgData = { type: 'CHAT', sender: myName, text };
    if (isHost) {
        broadcastMessage(msgData);
    } else if (hostConn) {
        hostConn.send(msgData);
    }
    addChatMessage(myName, text);
    chatInput.value = '';
}

function addChatMessage(sender, text) {
    const div = document.createElement('div');
    div.classList.add('chat-message');
    div.innerHTML = `<span class="sender">${sender}:</span> ${text}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}