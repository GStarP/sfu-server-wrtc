# sfu-server-wrtc

Implement a sfu server by [wrtc](https://github.com/node-webrtc/node-webrtc) in node environment.

## Quick Start

```bash
pnpm install
node server.js
```

Then the sfu server will listen on `3004(http)`, then follow steps below:

1. open `./example/index.html`, open console you will see this is `user@0`.
2. click the publish button, local stream will be capture and render, then send to the sfu server.
3. open another `index.html` as `user@1`.
4. clicl the subscribe button, input `0` (the user id of who is publishing stream).
5. then you will see remote stream rendered.

## Explanation

Learned from [simple_sfu](https://github.com/tiger2380/simple_sfu).

A sfu server shoule be able to build connections via ICE and (un)pack RTP packet which is the real form of a "media stream".

We can do this use lib like libnice but we can also use a complete webrtc implementation. This will save us a lot of work but import many features that we don't need and server ability is restricted by it.

By using wrtc, we can do the two main tasks like:

1. use `RTCPeerConnection` offer/answer signaling to build ICE connections.
2. pass PC1.tracks to PC2.addTrack in order to sending media stream received and saved in memory to another remote peer.
