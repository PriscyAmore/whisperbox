const DB_NAME = "WhisperBoxKeys";
const DB_VERSION = 1;
const STORE_NAME = "keys";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function storeKey(name, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(key, name);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function loadKey(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(name);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteKeys(username) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(`${username}_private`);
    store.delete(`${username}_public`);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function generateKeyPair(username) {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKeyBuffer = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));

  await storeKey(`${username}_private`, keyPair.privateKey);
  await storeKey(`${username}_public`, keyPair.publicKey);

  return { publicKeyBase64, keyPair };
}

export async function hasKeyPair(username) {
  const privateKey = await loadKey(`${username}_private`);
  return !!privateKey;
}

export async function getPrivateKey(username) {
  return await loadKey(`${username}_private`);
}

export async function importPublicKey(base64Key) {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    "spki",
    bytes.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

async function generateAESKey() {
  return await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function exportAESKey(key) {
  const raw = await window.crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

async function importAESKey(keyBytes) {
  return await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
}

export async function encryptMessage(plaintext, recipientPublicKeyBase64, senderPublicKeyBase64) {
  const aesKey = await generateAESKey();
  const aesKeyBytes = await exportAESKey(aesKey);

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedMessage = new TextEncoder().encode(plaintext);
  const encryptedMessage = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encodedMessage
  );

  const recipientPublicKey = await importPublicKey(recipientPublicKeyBase64);
  const encryptedKeyForRecipient = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    aesKeyBytes
  );

  const senderPublicKey = await importPublicKey(senderPublicKeyBase64);
  const encryptedKeyForSender = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    senderPublicKey,
    aesKeyBytes
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedMessage))),
    iv: btoa(String.fromCharCode(...iv)),
    encrypted_key_for_recipient: btoa(String.fromCharCode(...new Uint8Array(encryptedKeyForRecipient))),
    encrypted_key_for_sender: btoa(String.fromCharCode(...new Uint8Array(encryptedKeyForSender))),
  };
}

export async function decryptMessage(payload, username, isSender) {
  try {
    const privateKey = await getPrivateKey(username);
    if (!privateKey) throw new Error("Private key not found");

    const encryptedKeyBase64 = isSender
      ? payload.encrypted_key_for_sender
      : payload.encrypted_key_for_recipient;

    if (!encryptedKeyBase64) return "[encrypted]";

    const encryptedKeyBytes = Uint8Array.from(atob(encryptedKeyBase64), (c) => c.charCodeAt(0));
    const aesKeyBytes = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedKeyBytes
    );

    const aesKey = await importAESKey(new Uint8Array(aesKeyBytes));
    const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(payload.ciphertext), (c) => c.charCodeAt(0));

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return "[unable to decrypt]";
  }
}

export { deleteKeys };
