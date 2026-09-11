# Ehral Attendance Device Security Frontend

Implemented against the supplied attendance-device backend contract.

## Surfaces confirmed in this repository

- Employee mobile/web app: implemented.
- Employer/business dashboard: implemented.
- Ops Console: not present in this repository, so no Ops UI was added.

## Employee flow

- Generates a non-extractable P-256 ECDSA key pair with Web Crypto.
- Stores the CryptoKeyPair in IndexedDB, scoped to the active identity/business/membership context.
- Enrolls the device when the attendance screen is reached.
- Requests a fresh two-minute challenge immediately before a scan.
- Signs `challenge:employeeMembershipId:action` with ECDSA SHA-256.
- Sends `deviceId`, `deviceChallenge`, `deviceSignature`, and a fresh per-tap `requestId` to the existing `/attendance/scan` endpoint.
- If enrollment, challenge, signing, or secure storage is unavailable, the existing attendance scan still proceeds without fabricated device proof.
- Added Attendance device settings with current device status and revoke action.

## Employer flow

Added Attendance security inside the existing Attendance section:

- Devices list with employee, device, platform, binding/device status, and last seen.
- Employer device revoke action.
- Security events list with event type, risk level, status, and timestamp.
- Event detail and optional resolution note.
- Employee-facing attendance messages remain non-alarming. Risk levels and security-event language are kept in the employer view.

## Verification

The modified plain JavaScript files pass Node syntax checks. A full Vite production build could not be executed in this environment because the uploaded `node_modules` tree is incomplete and package installation could not finish due registry/network access. The source package itself is unchanged apart from the attendance-device implementation and this note.
