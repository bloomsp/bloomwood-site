# Dependabot audit notes

## Online audit attempt

Command:

```bash
npm audit --json
```

Result:

```
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
npm warn audit 403 Forbidden - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk
npm error audit endpoint returned an error
{
  "message": "403 Forbidden - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",
  "method": "POST",
  "uri": "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",
  "headers": {
    "content-length": [
      "9"
    ],
    "content-type": [
      "text/plain"
    ],
    "date": [
      "Mon, 02 Feb 2026 02:54:52 GMT"
    ],
    "server": [
      "envoy"
    ],
    "connection": [
      "close"
    ],
    "x-fetch-attempts": [
      "1"
    ]
  },
  "statusCode": 403,
  "body": "Forbidden",
  "error": {
    "summary": "",
    "detail": ""
  }
}
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-02-02T02_54_52_238Z-debug-0.log
```

## Offline audit attempt

Command:

```bash
npm audit --json --offline
```

Result:

```
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
{
  "auditReportVersion": 2,
  "vulnerabilities": {},
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 0,
      "moderate": 0,
      "high": 0,
      "critical": 0,
      "total": 0
    },
    "dependencies": {
      "prod": 468,
      "dev": 4,
      "optional": 151,
      "peer": 1,
      "peerOptional": 0,
      "total": 623
    }
  }
}
```
