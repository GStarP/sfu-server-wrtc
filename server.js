const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
// for cors test
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
// wrtc: node.js webrtc impl
const webrtc = require("wrtc");

const PORT = 3004;

// uid => socket
const socketMap = new Map();
// uid => { pc: peerconnection, stream: mediastream }
const pubMap = new Map();
// uid => peerconnection
const subMap = new Map();

// auto-inc id
let uid = 0;
io.on("connection", (socket) => {
  // uid should be string
  socket.id = "" + uid;
  uid++;
  console.log(`user@${socket.id} connected`);
  // send uid to client
  socket.send({
    type: "hi",
    uid: socket.id,
  });

  // save uid => socket
  socketMap.set(socket.id, socket);

  socket.on("close", () => {
    console.log(`user@${socket.id} disconnected`);
    // delete socket
    socketMap.delete(socket.id);
    /**
     * @ATTENTION
     * we assume that one client can only pub and sub one stream
     * so pub/sub each present one peerconnection for a client
     */
    // close then delete pub peerconnection
    if (pubMap.has(socket.id)) {
      pubMap.get(socket.id).pc.close();
      pubMap.delete(socket.id);
    }
    // close then delete sub peerconnection
    if (subMap.has(socket.id)) {
      subMap.get(socket.id).close();
      subMap.delete(socket.id);
    }
  });

  socket.on("message", async (msg) => {
    const { type } = msg;
    console.log(`user@${socket.id}: ${type}`);

    if (type === "pub") {
      /**
       * client publish its media stream
       * {
       *   type: 'pub',
       *   sdp: [client.localDescription]
       * }
       */
      if (pubMap.has(socket.id)) {
        console.error(`user@${socket.id} has already published a stream`)
        return;
      }
      const { sdp } = msg;
      // create pub pc
      const pc = createPC();
      pc.onicecandidate = (e) => {
        if (e.candidate && e.candidate.candidate) {
          socket.send({
            type: "ice",
            from: "pub",
            candidate: e.candidate,
          });
        }
      };
      // uid => { pc }
      pubMap.set(socket.id, { pc, stream: null });
      // save stream for transfer
      pc.ontrack = (e) => {
        if (e.streams && e.streams[0]) {
          pubMap.get(socket.id).stream = e.streams[0];
          console.log(`recv media track from user@${socket.id}`);
        }
      };
      // recv offer and send answer
      await pc.setRemoteDescription(new webrtc.RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      // send answer back to client
      socket.send({
        type: "pub",
        sdp: pc.localDescription,
      });
    } else if (type === "sub") {
      /**
       * client subscribe media stream from one specific client(including itself)
       * {
       *   type: 'sub',
       *   tar: [uid],
       *   sdp: [client.localDescription]
       * }
       */
      if (subMap.has(socket.id)) {
        console.error(`user@${socket.id} has already subscribed a stream`)
        return;
      }
      const { tar, sdp } = msg;
      // get pc which will be subscribed
      const pubPC = pubMap.get(tar);
      if (!pubPC) {
        console.error(`no such stream to subscribe: ${tar}`);
        return;
      }
      // create sub pc
      const pc = createPC();
      pc.onicecandidate = (e) => {
        if (e.candidate && e.candidate.candidate) {
          socket.send({
            type: "ice",
            from: "sub",
            candidate: e.candidate,
          });
        }
      };
      // uid => pc
      subMap.set(socket.id, pc);
      // pass published meida track to subscriber
      pubPC.stream.getTracks().forEach((track) => {
        console.log(`foward track for user@${socket.id} to subscribe`);
        pc.addTrack(track, pubPC.stream);
      });
      // recv offer and send answer
      await pc.setRemoteDescription(new webrtc.RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      // send answer back to client
      socket.send({
        type: "sub",
        sdp: pc.localDescription,
      });
    } else if (type === "ice") {
      /**
       * client send ice candidates
       * {
       *   type: 'ice',
       *   from: 'pub' | 'sub',
       *   candidate: [client.iceCandidate]
       * }
       */
      const { from, candidate } = msg;
      let pc;
      // recv both pub&sub candidates
      if (from === "pub") {
        pc = pubMap.get(socket.id).pc;
      } else if (from === "sub") {
        pc = subMap.get(socket.id);
      }
      if (pc) {
        pc.addIceCandidate(new webrtc.RTCIceCandidate(candidate));
      }
    }
  });
});

/**
 * create peerconnection
 */
function createPC() {
  const pc = new webrtc.RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.stunprotocol.org:3478" },
      { urls: "stun:stun.l.google.com:19302" },
    ],
  });
  return pc;
}

/**
 * launch server
 */
server.listen(PORT, () => {
  console.log(`sfu server listening on ${PORT}`);
});
