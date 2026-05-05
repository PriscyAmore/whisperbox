const DB_NAME = "WhisperBoxKeys";
const DB_VERSION = 1;
const STORE_NAME = "keys";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE_NAME);
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

// Store private key as exportable JWK in localStorage as backup
async function storePrivateKeyBackup(username, privateKey) {
  try {
    const jwk = await window.crypto.subtle.exportKey("jwk", privateKey);
    localStorage.setItem(`pk_${username}`, JSON.stringify(jwk));
  } catch {}
}

async function getPrivateKeyFromBackup(username) {
  try {
    const jwkStr = localStorage.getItem(`pk_${username}`);
    if (!jwkStr) return null;
    const jwk = JSON.parse(jwkStr);
    return await window.crypto.subtle.importKey(
      "jwk", jwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false, ["decrypt"]
    );
  } catch { return null; }
}

export async function generateKeyPair(username) {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["encrypt", "decrypt"]
  );
  const publicKeyBuffer = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));
  
  // Store in IndexedDB
  await storeKey(`${username}_private`, keyPair.privateKey);
  
  // Also backup to localStorage
  await storePrivateKeyBackup(username, keyPair.privateKey);
  
  return { publicKeyBase64 };
}

export async function hasKeyPair(username) {
  const key = await loadKey(`${username}_private`);
  const backup = localStorage.getItem(`pk_${username}`);
  return !!(key || backup);
}

export async function getPrivateKey(username) {
  // Try IndexedDB first
  const key = await loadKey(`${username}_private`);
  if (key) return key;
  // Fall back to localStorage backup
  return await getPrivateKeyFromBackup(username);
}

export async function importPublicKey(base64Key) {
  const cleaned = base64Key.replace(/[\s\n\r]/g, '');
  const bytes = Uint8Array.from(atob(cleaned), c => c.charCodeAt(0));
  return await window.crypto.subtle.importKey(
    "spki", bytes.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false, ["encrypt"]
  );
}

export async function encryptMessage(plaintext, recipientPubBase64, senderPubBase64) {
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
  );
  const aesKeyBytes = new Uint8Array(await window.crypto.subtle.exportKey("raw", aesKey));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedMsg = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, aesKey, new TextEncoder().encode(plaintext)
  );
  const recipientKey = await importPublicKey(recipientPubBase64);
  const senderKey = await importPublicKey(senderPubBase64);
  const encKeyForRecipient = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" }, recipientKey, aesKeyBytes
  );
  const encKeyForSender = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" }, senderKey, aesKeyBytes
  );
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedMsg))),
    iv: btoa(String.fromCharCode(...iv)),
    encrypted_key_for_recipient: btoa(String.fromCharCode(...new Uint8Array(encKeyForRecipient))),
    encrypted_key_for_sender: btoa(String.fromCharCode(...new Uint8Array(encKeyForSender))),
  };
}

export async function decryptMessage(payload, username, isSender) {
  try {
    const privateKey = await getPrivateKey(username);
    if (!privateKey) return "[no private key]";
    
    const encKeyB64 = isSender
      ? payload.encrypted_key_for_sender
      : payload.encrypted_key_for_recipient;
    
    if (!encKeyB64) return "[missing key]";
    
    const encKeyBytes = Uint8Array.from(atob(encKeyB64), c => c.charCodeAt(0));
    const aesKeyBytes = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" }, privateKey, encKeyBytes
    );
    const aesKey = await window.crypto.subtle.importKey(
      "raw", new Uint8Array(aesKeyBytes),
      { name: "AES-GCM" }, false, ["decrypt"]
    );
    const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(payload.ciphertext), c => c.charCodeAt(0));
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv }, aesKey, ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    return `[decrypt error: ${e.message}]`;
  }
}

export async function deleteKeys(username) {
  localStorage.removeItem(`pk_${username}`);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(`${username}_private`);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}
