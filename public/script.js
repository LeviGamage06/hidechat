const socket = io();

const joinContainer = document.getElementById('join-container');
const joinForm = document.getElementById('join-form');
const roomInput = document.getElementById('room-input');

const chatContainer = document.getElementById('chat-container');
const roomDisplay = document.getElementById('room-display');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const messages = document.getElementById('messages');

let currentRoom = '';

let myKeyPair = null;
let sharedAesKey = null;

async function setupCrypto() {
    myKeyPair = await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey"]
    );
}
setupCrypto();

joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const roomCode = roomInput.value.trim();
    if (roomCode) {
        currentRoom = roomCode;
        socket.emit('join room', currentRoom);
        
        const exportedKey = await window.crypto.subtle.exportKey("jwk", myKeyPair.publicKey);
        socket.emit('public key', { room: currentRoom, key: exportedKey });
        
        roomDisplay.textContent = currentRoom;
        joinContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
    }
});

socket.on('user joined', async () => {
    const exportedKey = await window.crypto.subtle.exportKey("jwk", myKeyPair.publicKey);
    socket.emit('public key', { room: currentRoom, key: exportedKey });
});

socket.on('public key', async (theirJwkKey) => {
    const theirPublicKey = await window.crypto.subtle.importKey(
        "jwk", theirJwkKey, { name: "ECDH", namedCurve: "P-256" }, true, []
    );

    sharedAesKey = await window.crypto.subtle.deriveKey(
        { name: "ECDH", public: theirPublicKey },
        myKeyPair.privateKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
    
    const item = document.createElement('li');
    item.textContent = "🔒 Secure E2EE Connection Established!";
    item.style.color = "#4caf50";
    item.style.fontSize = "12px";
    item.style.textAlign = "center";
    messages.appendChild(item);
});

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageInput.value;
    
    if (text && sharedAesKey) {
        const encodedText = new TextEncoder().encode(text);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        
        const ciphertextBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            sharedAesKey,
            encodedText
        );
        
        const item = document.createElement('li');
        item.textContent = "Me: " + text;
        messages.appendChild(item);
        messages.scrollTo(0, messages.scrollHeight);

        socket.emit('chat message', {
            room: currentRoom,
            iv: Array.from(iv),
            ciphertext: Array.from(new Uint8Array(ciphertextBuffer))
        });
        
        messageInput.value = '';
    } else if (!sharedAesKey) {
        alert("Waiting for another person to join and establish a secure connection!");
    }
});

socket.on('chat message', async (data) => {
    if (sharedAesKey) {
        try {
            const iv = new Uint8Array(data.iv);
            const ciphertext = new Uint8Array(data.ciphertext);
            
            const decryptedBuffer = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                sharedAesKey,
                ciphertext
            );
            
            const decryptedText = new TextDecoder().decode(decryptedBuffer);
            
            const item = document.createElement('li');
            item.textContent = "Friend: " + decryptedText;
            messages.appendChild(item);
            messages.scrollTo(0, messages.scrollHeight);
        } catch (err) {
            console.error("Could not decrypt message", err);
        }
    }
});

// අලුත් කොටස: අනිත් කෙනා චැට් එකෙන් ගියාම මතකය මකා දැමීම (Self-destruct)
socket.on('user left', () => {
    alert("🔒 Privacy Alert: Your friend has left the chat. For your safety, this room will now self-destruct and all memory will be erased.");
    // මේකෙන් මුළු පිටුවම අලුත් වෙලා, තියෙන දත්ත ඔක්කොම මැකිලා යනවා
    window.location.reload(); 
});