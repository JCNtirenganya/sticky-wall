/* Live phone streaming for the Sticky Wall.
   A phone opens its camera, creates a WebRTC offer, and the presenter board
   answers. Only the small SDP/ICE handshake travels through Supabase Realtime
   (or a BroadcastChannel in demo mode); the video itself goes phone → board.

   Free infrastructure has no guaranteed TURN relay, so a public TURN relay is
   included as a last resort for phones on another network. Set TURN_URL /
   TURN_USERNAME / TURN_CREDENTIAL in config.js to use your own relay, or set
   LIVE_ICE_SERVERS to a full list. Set LIVE_PUBLIC_TURN: false to disable the
   shared public relay. */
(() => {
  const C = window.STICKY_CONFIG || {};
  const STUN_URLS = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun.cloudflare.com:3478"
  ];
  const PUBLIC_TURN = [
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
  ];

  function iceServers() {
    if (Array.isArray(C.LIVE_ICE_SERVERS) && C.LIVE_ICE_SERVERS.length) return C.LIVE_ICE_SERVERS;
    const list = [{ urls: STUN_URLS }];
    if (C.TURN_URL) {
      list.push({
        urls: C.TURN_URL,
        username: C.TURN_USERNAME || "",
        credential: C.TURN_CREDENTIAL || ""
      });
    } else if (C.LIVE_PUBLIC_TURN !== false) {
      list.push(...PUBLIC_TURN);
    }
    return list;
  }

  const uniqueId = () => window.crypto?.randomUUID
    ? crypto.randomUUID()
    : "l-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  const getBus = () => window.Store?.liveBus || null;
  const serialiseCandidate = candidate => candidate?.toJSON ? candidate.toJSON() : candidate;

  /* ── phone: camera → board ─────────────────────────────────── */
  async function stream({ author, facingMode = "environment", mediaStream, onStatus } = {}) {
    const bus = getBus();
    if (!bus) throw new Error("Live signalling is not available");
    if (!mediaStream && !navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser cannot open the camera");
    }

    const owned = !mediaStream;
    const local = mediaStream || await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 }
      }
    });
    local.getVideoTracks().forEach(track => {
      try { track.contentHint = "motion"; } catch {}
    });

    const streamId = uniqueId();
    const emit = (state, detail) => { try { onStatus?.(state, detail); } catch {} };
    let pc = null, answered = false, closed = false, remoteSet = false;
    let pendingIce = [], lastOfferAt = 0, offering = null;
    let announceTimer = 0, troubleTimer = 0, restartTimer = 0;
    let unlisten = null;

    const send = msg => bus.send(msg).catch(err => {
      console.warn("Live signal could not be sent", err);
      return false;
    });

    function buildPeer() {
      if (pc) { try { pc.close(); } catch {} }
      answered = false;
      remoteSet = false;
      lastOfferAt = 0;
      pendingIce = [];
      pc = new RTCPeerConnection({ iceServers: iceServers(), bundlePolicy: "max-bundle" });
      local.getTracks().forEach(track => pc.addTrack(track, local));

      pc.onicecandidate = event => {
        if (!event.candidate || closed) return;
        send({ type: "ice", streamId, from: "phone", candidate: serialiseCandidate(event.candidate) });
      };
      pc.onconnectionstatechange = () => {
        const state = pc?.connectionState;
        if (state === "connected") {
          answered = true;
          clearInterval(announceTimer); announceTimer = 0;
          clearTimeout(troubleTimer); troubleTimer = 0;
          clearTimeout(restartTimer); restartTimer = 0;
          emit("live");
        } else if (state === "failed") {
          emit("reconnecting");
          scheduleRestart(1200);
        } else if (state === "disconnected") {
          emit("reconnecting");
          scheduleRestart(5000);
        }
      };
      return pc;
    }

    function scheduleRestart(delay) {
      if (closed || restartTimer) return;
      restartTimer = setTimeout(() => {
        restartTimer = 0;
        if (closed || pc?.connectionState === "connected") return;
        buildPeer();
        announce();
      }, delay);
    }

    function announce() {
      if (closed) return;
      send({ type: "announce", streamId, author: author || "" });
    }

    async function makeOffer() {
      if (closed || answered || !pc) return;
      if (pc.signalingState === "have-local-offer") {
        /* A fresh board may have missed the first offer; retry after a pause. */
        if (Date.now() - lastOfferAt < 6000) return;
        buildPeer();
      }
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        lastOfferAt = Date.now();
        const description = pc.localDescription;
        const sdp = description ? { type: description.type, sdp: description.sdp } : null;
        const ok = await send({ type: "offer", streamId, author: author || "", sdp });
        if (ok === false) { buildPeer(); return; }
        if (!troubleTimer) {
          troubleTimer = setTimeout(() => {
            troubleTimer = 0;
            if (!closed && pc?.connectionState !== "connected") emit("trouble");
          }, 15000);
        }
      } catch (err) {
        console.warn("Could not create a live offer", err);
      }
    }

    function offer() {
      if (offering) return offering;
      offering = makeOffer().finally(() => { offering = null; });
      return offering;
    }

    async function handleSignal(msg) {
      if (closed || !msg || msg.streamId !== streamId) return;
      if (msg.type === "board-ready") {
        if (!answered) offer();
      } else if (msg.type === "answer") {
        if (answered || !pc || pc.signalingState !== "have-local-offer") return;
        try {
          await pc.setRemoteDescription(msg.sdp);
          remoteSet = true;
          for (const candidate of pendingIce.splice(0)) {
            pc.addIceCandidate(candidate).catch(() => {});
          }
          answered = true;
          emit("connecting");
        } catch (err) {
          console.warn("Could not accept the board answer", err);
          buildPeer();
        }
      } else if (msg.type === "ice" && msg.from === "board") {
        if (remoteSet) pc.addIceCandidate(msg.candidate).catch(() => {});
        else pendingIce.push(msg.candidate);
      }
    }

    emit("waiting");
    await bus.ready();
    unlisten = bus.on(handleSignal);
    buildPeer();
    announce();
    announceTimer = setInterval(() => {
      if (!closed && pc?.connectionState !== "connected") announce();
    }, 3500);

    function stop() {
      if (closed) return;
      closed = true;
      clearInterval(announceTimer); announceTimer = 0;
      clearTimeout(troubleTimer); troubleTimer = 0;
      clearTimeout(restartTimer); restartTimer = 0;
      unlisten?.(); unlisten = null;
      send({ type: "bye", streamId });
      try { pc?.close(); } catch {}
      pc = null;
      if (owned) local.getTracks().forEach(track => { try { track.stop(); } catch {} });
      emit("ended");
    }

    return {
      streamId,
      stream: local,
      stop,
      get state() { return pc?.connectionState || "closed"; }
    };
  }

  /* ── board: answer phones and hand back their streams ──────── */
  function host({ onStream, onEnd, onStatus } = {}) {
    const bus = getBus();
    if (!bus) return { stop() {} };

    const peers = new Map();
    let stopped = false;

    const send = msg => bus.send(msg).catch(err => {
      console.warn("Live signal could not be sent", err);
    });

    function closePeer(streamId, notify) {
      const peer = peers.get(streamId);
      if (!peer) return;
      peers.delete(streamId);
      clearTimeout(peer.disconnectTimer);
      try { peer.pc.close(); } catch {}
      if (notify) {
        try { onEnd?.(streamId); } catch {}
      }
    }

    async function acceptOffer(msg) {
      if (!msg.sdp || stopped) return;
      let peer = peers.get(msg.streamId);
      if (peer && peer.pc.connectionState === "connected") return;
      if (peer && ["failed", "closed", "disconnected"].includes(peer.pc.connectionState)) {
        closePeer(msg.streamId, false);
        peer = null;
      }

      if (!peer) {
        const pc = new RTCPeerConnection({ iceServers: iceServers(), bundlePolicy: "max-bundle" });
        peer = {
          pc,
          streamId: msg.streamId,
          author: msg.author || "",
          remoteSet: false,
          pending: [],
          disconnectTimer: 0,
          notified: false
        };
        peers.set(msg.streamId, peer);

        pc.onicecandidate = event => {
          if (!event.candidate || stopped) return;
          send({
            type: "ice",
            streamId: msg.streamId,
            from: "board",
            candidate: serialiseCandidate(event.candidate)
          });
        };
        pc.ontrack = event => {
          if (stopped || peer.notified || event.track.kind !== "video") return;
          const remote = event.streams[0];
          if (!remote) return;
          peer.notified = true;
          peer.stream = remote;
          try {
            onStream?.({
              streamId: msg.streamId,
              author: peer.author || msg.author || "",
              stream: remote
            });
          } catch (err) { console.error("Could not show the live stream", err); }
        };
        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          if (state === "connected") {
            clearTimeout(peer.disconnectTimer);
            peer.disconnectTimer = 0;
            try { onStatus?.("live", { streamId: msg.streamId, author: peer.author }); } catch {}
          } else if (state === "failed" || state === "closed") {
            closePeer(msg.streamId, true);
          } else if (state === "disconnected") {
            clearTimeout(peer.disconnectTimer);
            peer.disconnectTimer = setTimeout(() => {
              if (pc.connectionState !== "connected") closePeer(msg.streamId, true);
            }, 6000);
          }
        };
      }

      try {
        await peer.pc.setRemoteDescription(msg.sdp);
        peer.remoteSet = true;
        for (const candidate of peer.pending.splice(0)) {
          peer.pc.addIceCandidate(candidate).catch(() => {});
        }
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        const description = peer.pc.localDescription;
        const sdp = description ? { type: description.type, sdp: description.sdp } : null;
        send({ type: "answer", streamId: msg.streamId, to: "phone", sdp });
      } catch (err) {
        console.warn("Could not answer a live stream", err);
        closePeer(msg.streamId, false);
      }
    }

    const unlisten = bus.on(msg => {
      if (stopped || !msg) return;
      if (msg.type === "announce") {
        const peer = peers.get(msg.streamId);
        if (!peer || peer.pc.connectionState !== "connected") {
          send({ type: "board-ready", streamId: msg.streamId, to: "phone" });
        }
      } else if (msg.type === "offer") {
        acceptOffer(msg);
      } else if (msg.type === "ice" && msg.from === "phone") {
        const peer = peers.get(msg.streamId);
        if (!peer) return;
        if (peer.remoteSet) peer.pc.addIceCandidate(msg.candidate).catch(() => {});
        else peer.pending.push(msg.candidate);
      } else if (msg.type === "bye") {
        closePeer(msg.streamId, true);
      }
    });

    bus.ready()
      .then(() => send({ type: "board-ready", to: "phone" }))
      .catch(err => console.warn("Live channel is not ready", err));

    return {
      stop() {
        stopped = true;
        unlisten?.();
        for (const streamId of [...peers.keys()]) closePeer(streamId, true);
      }
    };
  }

  window.StickyLive = { stream, host, iceServers };
})();
