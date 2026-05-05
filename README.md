# WhisperBox — End-to-End Encrypted Messaging

A secure messaging app where the server never sees plaintext. All encryption happens on the client using the Web Crypto API.

## Encryption
- RSA-OAEP 2048-bit for key exchange
- AES-GCM 256-bit for message encryption
- Private keys stored in IndexedDB — never leave the device

## Setup
```bash
npm install
npm run dev
