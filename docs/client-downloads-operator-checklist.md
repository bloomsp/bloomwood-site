# Client Downloads Operator Checklist

Use this when delivering recovered files to a client.

## Before you start

- confirm the client/job reference
- confirm which files are safe and ready to release
- confirm the intended expiry window
- make sure the D1 schema has been applied
- make sure the R2 bucket exists

## Standard workflow

### 1) Prepare the delivery folder
Create a local folder for the delivery batch, for example:

- `./recovery-2026-0042`

Put the client-ready files inside it.

### 2) Upload files to R2 and generate the manifest

```bash
npm run downloads:upload -- \
  --source ./recovery-2026-0042 \
  --bucket bloomwood-client-downloads \
  --job-reference 2026-0042 \
  --client-name "Jane Citizen" \
  --client-email jane@example.com \
  --notes "Recovered family photos" \
  --remote
```

This will:
- upload the files to R2
- generate a manifest file such as `client-download-2026-0042.json`

### 3) Issue the download link

```bash
npm run downloads:issue -- \
  --manifest ./client-download-2026-0042.json \
  --db CLIENT_DOWNLOADS_DB \
  --remote
```

This will print the final client URL.

### 4) Send the link to the client
Use your normal client communication channel.

Recommended message contents:
- brief explanation of what is included
- expiry date/time
- reminder to download promptly

### 5) Record completion
Log internally that:
- files were uploaded
- link was issued
- expiry was communicated

## Good operating defaults

- default expiry: **7 days**
- use clear job references
- keep raw download URLs private
- regenerate instead of reusing old links
- revoke and reissue if a link is sent to the wrong recipient

## If something goes wrong

### Link expired
- issue a new token from the same manifest or job data

### Wrong files uploaded
- remove/replace the affected R2 objects
- revoke the token
- upload corrected files
- issue a fresh link

### Client reports download failure
Check:
- token expiry
- whether the file exists in R2
- whether the file row points to the correct `r2Key`
- D1 event logs for blocked/download attempts

## Recommended next improvements

- add a private internal admin page
- add revoke/regenerate tooling
- add a small audit viewer for download events
