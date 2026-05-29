<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Act as a Security \& Distributed Systems Architect. I am building a collaborative notes app (Yjs + Supabase) and I need to introduce End-to-End Encryption (E2EE) without breaking real-time collaboration.

What is the standard architectural pattern for encrypting Yjs document updates locally using the Web Crypto API, while still allowing the server to sync encrypted deltas?
How can I manage encryption keys (derivation and sharing) across multiple devices for a single user without storing master keys on the backend?
Provide a 'Conflict Resolution Strategy' checklist for offline-first clients that reconnect after long periods (days/weeks) to ensure the CRDT (Yjs) doesn't suffer from 'update storms' or state divergence. Deliver a robust E2EE + Sync protocol design

Use a **client-encrypted CRDT relay** pattern: the browser keeps the Yjs document in plaintext only in memory, encrypts each serialized update locally with Web Crypto, and the backend stores and relays opaque encrypted deltas without understanding the document content. This matches the “store a linear history of document updates” approach for Yjs and the snapshot-plus-update relay model used by Secsync, while Supabase Realtime can still move encrypted payloads as ordinary messages or rows.[^1][^2][^3]

## Standard architecture

The cleanest pattern is:

1. The editor mutates a local `Y.Doc`.
2. A Yjs update is produced from the local doc.
3. The client encrypts that update with a document/session key using Web Crypto.
4. The client uploads only ciphertext plus minimal routing metadata.
5. The server stores and broadcasts ciphertext unchanged.
6. Other devices fetch missing ciphertext, decrypt locally, and apply the update to their own `Y.Doc`.
This keeps collaboration real-time while preserving E2EE, because the relay never needs plaintext to forward, persist, or fan out updates.[^4][^3][^1]

A good practical split is:

- `Y.Doc` in memory for collaboration.
- `y-indexeddb` or equivalent for local persistence.
- A sync envelope around each update: `{docId, snapshotId, clientId, clock, nonce, ciphertext, authTag, sig}`.
- Supabase as opaque transport/storage, not a CRDT-aware authority.[^5][^6][^2][^7]


## Encryption flow

Use an **encrypt-at-the-edge** flow on the client, not in the server pipeline. Web Crypto is suitable for generating keys, deriving keys, encrypting, decrypting, and signing material in the browser.[^8][^4]

Recommended client flow:

- Create or load the local `Y.Doc`.
- Convert changes to Yjs updates.
- Buffer small updates briefly, then batch them into a single encrypted transport packet.
- Encrypt with an AEAD scheme such as AES-GCM or XChaCha20-Poly1305 equivalent if you use a library; Web Crypto natively supports AES-GCM well.[^4][^8]
- Include authenticated metadata outside the ciphertext so the server can route packets by document and version without learning note contents.[^3]

For Yjs specifically, do **not** encrypt the whole database row blindly if you need efficient sync. Encrypt the document payload/update body, but leave enough unencrypted metadata for:

- document routing,
- ordering/versioning,
- replay detection,
- collaborator membership enforcement.[^9][^3]


## Key management model

Do **not** store a master key on the backend. Instead, use a **per-user root secret** kept only on user devices, and derive per-document keys locally. For multiple devices, treat each device as an authenticated holder of its own device keypair, then wrap sharing keys for that device.

A robust model looks like this:

### 1. User root secret

- Generate on first setup from a strong random seed on-device.
- Optionally derive from a password using PBKDF2 or, better, Argon2id implemented in WASM.
- Never upload the root secret.
- Use it only to derive higher-level keys locally.[^8][^4]


### 2. Device identity keys

Each device generates:

- a long-term signing key pair,
- an optional key agreement key pair.

Store private keys only in IndexedDB / secure storage, wrapped with a device-local secret or the user’s unlocked session state.

Use these keys to authenticate new device enrollment and encrypt key material for that device.

### 3. Per-document keys

Derive a document key from the root secret and document ID, or generate a random document key and then wrap it for each authorized device.

Two common options:

- **Derive:** `docKey = HKDF(rootSecret, docId, context)`.
- **Wrap:** `docKey = random`; share it by encrypting it to each device’s public key.

For multi-device sync, the **wrap** model is usually better because:

- it supports revocation,
- it allows rotation,
- it avoids all devices sharing the same raw long-term secret.[^3]


### 4. Key envelopes

Store encrypted key envelopes in the backend:

- `user/device public key`
- `encrypted docKey`
- `issuedAt`, `keyVersion`, `role`

The server sees only ciphertext envelopes and routing metadata, not the underlying master secret.[^7][^3]

## Multi-device sharing

For one user across phone, laptop, tablet:

- The first device creates the user identity and document key.
- The user approves a new device through an out-of-band trust step, such as QR code, passkey-backed approval, or an authenticated session plus device verification.
- The existing device encrypts a device-enrollment secret or per-document key to the new device’s public key.
- The backend stores the envelope, but cannot open it.

This avoids a backend-stored master key while still enabling seamless login on multiple devices. If you need easier recovery, add an optional recovery phrase or recovery key that the user explicitly stores offline; that phrase should decrypt a root recovery vault only on the client.[^7][^4]

### Best practice for rotation

Rotate keys when:

- a device is removed,
- a share permission changes,
- a recovery event occurs,
- long-lived documents need forward secrecy improvements.

When rotating, create a new document key version and a new snapshot. Old updates can remain stored but become undecryptable to revoked devices.[^3]

## Sync protocol design

A solid protocol for E2EE + Yjs sync is:

### Transport objects

- **Snapshot:** encrypted full-state checkpoint.
- **Update:** encrypted incremental Yjs deltas.
- **Ack:** server-issued monotonic version or cursor.
- **Presence:** optional ephemeral unencrypted or separately encrypted realtime cursor/status.


### Server responsibilities

- Store ciphertext snapshots and updates.
- Assign monotonic storage versions.
- Return all updates after a known cursor.
- Never decrypt, merge semantic content, or rewrite plaintext CRDT state.[^1][^3]


### Client responsibilities

- Maintain local Yjs state and local persistence.
- Track last applied server version plus Yjs state vector.
- Request only missing encrypted updates.
- Decrypt, validate, and apply in order.
- Periodically compact local history into a new encrypted snapshot.

This is close to the Secsync model: snapshot + updates + per-update versioning, with the server acting as a relay and ordering service rather than a CRDT interpreter.[^3]

## Conflict resolution checklist

For offline-first clients that reconnect after days or weeks, use this checklist to prevent update storms and divergence:

- Rehydrate the local `Y.Doc` first from IndexedDB before opening the network channel.
- Compare local state vector against the last acknowledged remote version.
- Request a bounded delta window first, then fall back to a snapshot if the gap is large.
- Apply remote updates in deterministic version order.
- Deduplicate by `(docId, clientId, clock)` or a similar unique update identity.
- Reject duplicate, stale, or replayed updates before decryption or application.
- Batch incoming updates into a short apply queue instead of applying one websocket packet at a time.
- After applying a large remote batch, emit one local render refresh, not one per update.
- If local and remote histories diverged too far, discard the local transient network queue and rebase from the latest decrypted snapshot.
- Compact long histories into a fresh snapshot after sync completes.
- Cap reconnect catch-up bandwidth and processing time per tick to keep the UI responsive.
- Use idempotent persistence for both snapshot and delta writes.
- Validate schema and document invariants after decryption but before applying to shared state.
- Keep an append-only audit of received versions so missing ranges can be detected cleanly.
- If key rotation happened while offline, fetch the new key envelope before requesting old encrypted ranges.[^5][^1][^3]


## Handling update storms

The main antidote to update storms is **server-side ordering plus client-side batching**. Do not send a separate UI reaction for every remote packet; coalesce them into micro-batches and let Yjs resolve the CRDT state once per batch.[^1][^3]

Practical rules:

- Batch multiple local changes into a single encrypted update every 100–300 ms.
- On reconnect, fetch missing versions in chunks.
- After each chunk, apply locally, then request the next chunk.
- Trigger a snapshot when the number of pending updates or total byte size exceeds a threshold.
- Keep presence/cursor traffic separate from durable document updates.[^2][^3]


## Suggested data model

A workable Supabase schema pattern is:

- `documents`: routing metadata only.
- `document_updates`: `doc_id`, `version`, `client_id`, `clock`, `ciphertext`, `nonce`, `created_at`.
- `document_snapshots`: `doc_id`, `snapshot_id`, `base_version`, `ciphertext`, `created_at`.
- `document_keys`: `doc_id`, `device_id`, `key_version`, `encrypted_doc_key`, `created_at`.

The server can index by `doc_id` and `version` while never decrypting payloads. That gives you efficient range fetches, replay protection, and a clean migration path for snapshot compaction.[^2][^7][^3]

## Recommended stack choices

For your SmartNotes-style app, I would implement:

- Yjs + IndexedDB for local CRDT state.
- Web Crypto for encryption, wrapping, and signing.
- Supabase Postgres for ciphertext persistence and metadata.
- Supabase Realtime for low-latency broadcast of encrypted envelopes.
- Periodic encrypted snapshots for fast cold starts and long-offline recovery.[^6][^5][^4][^2]

If you want, I can turn this into a concrete protocol spec with message schemas, key hierarchy diagrams, and TypeScript pseudocode for `encryptUpdate()`, `decryptUpdate()`, and `syncReconnect()`.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^21][^22][^23][^24]</span>

<div align="center">⁂</div>

[^1]: https://discuss.yjs.dev/t/implementing-end-to-end-encryption/308

[^2]: https://supabase.com/realtime

[^3]: https://github.com/nikgraf/secsync

[^4]: https://w3c.github.io/webcrypto/

[^5]: note-lifecycle.md

[^6]: architecture.md

[^7]: https://supabase.com/docs/guides/database/secure-data

[^8]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API

[^9]: https://discuss.yjs.dev/t/end-to-end-encryption-with-schema-validation/2263

[^10]: ai-copilot.md

[^11]: structure.md

[^12]: provider.md

[^13]: implementation-status.md

[^14]: features.md

[^15]: environment.md

[^16]: readme.md

[^17]: https://nodejs.org/api/webcrypto.html

[^18]: https://github.com/yjs/yjs/blob/main/README.md

[^19]: https://dev.to/cardoso/end-to-end-encrypted-chat-with-the-web-crypto-api-3d02

[^20]: https://supabase.com/docs/guides/realtime

[^21]: https://www.w3.org/TR/webcrypto-2/

[^22]: https://www.thedroptimes.com/podcast/tag1-team-talks/deep-dive-end-end-encryption-e2ee-in-yjs-part-2-tag1-teamtalk

[^23]: https://nodejs.org/download/nightly/v22.0.0-nightly202402013fbe1579ce/docs/api/webcrypto.html

[^24]: https://news.ycombinator.com/item?id=39960190

