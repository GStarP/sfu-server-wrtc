# sfu-server-wrtc

Implement a sfu server by wrtc in node environment.

## Quick Start

```bash
pnpm install
node server.js
```

Then the sfu server will listen on `3004(http)`,` then follow steps below:

1. open `./example/index.html`, open console you will see this is `user@0`.
2. click the publish button, local stream will be capture and render, then send to the sfu server.
3. open another `index.html` as `user@1`.
4. clicl the subscribe button, input `0` (the user id of who is publishing stream).
5. then you will see remote stream rendered.