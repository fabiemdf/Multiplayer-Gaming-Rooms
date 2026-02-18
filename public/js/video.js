/* ════════════════════════════════════════════════════════════════
   VIDEO MANAGER – WebRTC peer-to-peer video
   ════════════════════════════════════════════════════════════════ */

const VideoManager = (() => {
  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  let localStream = null;
  let peers = {};         // peerId -> RTCPeerConnection
  let peerNames = {};     // peerId -> username
  let micEnabled = true;
  let camEnabled = true;
  let videoActive = false;

  function init() {
    document.getElementById('toggle-video-btn').addEventListener('click', toggleVideoPanel);
    document.getElementById('close-video-btn').addEventListener('click', stopVideo);
    document.getElementById('toggle-mic-btn').addEventListener('click', toggleMic);
    document.getElementById('toggle-cam-btn').addEventListener('click', toggleCam);
  }

  async function toggleVideoPanel() {
    if (!videoActive) {
      await startVideo();
    } else {
      stopVideo();
    }
  }

  async function startVideo() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const localVideo = document.getElementById('local-video');
      localVideo.srcObject = localStream;
      document.getElementById('video-panel').classList.remove('hidden');
      videoActive = true;
      SocketClient.videoJoined();
      App.toast('Video started', 'success');
    } catch (err) {
      App.toast('Camera access denied', 'error');
      console.warn('Video error:', err);
    }
  }

  function stopVideo() {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    // Close all peer connections
    Object.values(peers).forEach(pc => pc.close());
    peers = {};

    // Remove remote video tiles
    document.querySelectorAll('.video-tile:not(#local-video-tile)').forEach(el => el.remove());
    document.getElementById('local-video').srcObject = null;
    document.getElementById('video-panel').classList.add('hidden');
    videoActive = false;
    SocketClient.videoLeft();
  }

  function toggleMic() {
    if (!localStream) return;
    micEnabled = !micEnabled;
    localStream.getAudioTracks().forEach(t => { t.enabled = micEnabled; });
    const btn = document.getElementById('toggle-mic-btn');
    btn.textContent = micEnabled ? '🎤' : '🔇';
    btn.style.opacity = micEnabled ? '1' : '0.5';
  }

  function toggleCam() {
    if (!localStream) return;
    camEnabled = !camEnabled;
    localStream.getVideoTracks().forEach(t => { t.enabled = camEnabled; });
    const btn = document.getElementById('toggle-cam-btn');
    btn.textContent = camEnabled ? '📷' : '📷';
    btn.style.opacity = camEnabled ? '1' : '0.5';
    document.getElementById('local-video').style.opacity = camEnabled ? '1' : '0.3';
  }

  // Called when a peer joins video (we initiate the offer)
  async function onPeerJoined(peerId, username) {
    if (!videoActive) return;
    peerNames[peerId] = username;
    const pc = createPeerConnection(peerId);
    peers[peerId] = pc;

    // Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    SocketClient.webrtcOffer(peerId, offer);
  }

  async function onPeerLeft(peerId) {
    if (peers[peerId]) {
      peers[peerId].close();
      delete peers[peerId];
    }
    const tile = document.getElementById(`video-tile-${peerId}`);
    if (tile) tile.remove();
    updateGrid();
  }

  async function handleOffer(fromId, offer) {
    if (!videoActive) return;
    const pc = createPeerConnection(fromId);
    peers[fromId] = pc;

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    SocketClient.webrtcAnswer(fromId, answer);
  }

  async function handleAnswer(fromId, answer) {
    const pc = peers[fromId];
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async function handleIceCandidate(fromId, candidate) {
    const pc = peers[fromId];
    if (!pc || !candidate) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) { /* ignore */ }
  }

  function createPeerConnection(peerId) {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    // ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) SocketClient.webrtcIce(peerId, candidate);
    };

    // Remote stream
    pc.ontrack = ({ streams: [stream] }) => {
      addRemoteTile(peerId, stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        onPeerLeft(peerId);
      }
    };

    return pc;
  }

  function addRemoteTile(peerId, stream) {
    const grid = document.getElementById('video-grid');
    let tile = document.getElementById(`video-tile-${peerId}`);
    if (!tile) {
      tile = document.createElement('div');
      tile.className = 'video-tile';
      tile.id = `video-tile-${peerId}`;

      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;

      const label = document.createElement('span');
      label.className = 'video-label';
      label.textContent = peerNames[peerId] || 'Player';

      tile.appendChild(video);
      tile.appendChild(label);
      grid.appendChild(tile);
    }
    tile.querySelector('video').srcObject = stream;
    updateGrid();
  }

  function updateGrid() {
    const grid = document.getElementById('video-grid');
    const count = grid.querySelectorAll('.video-tile').length;
    grid.className = 'video-grid' + (count === 1 ? ' single' : '');
  }

  function cleanup() {
    stopVideo();
    peerNames = {};
  }

  return { init, onPeerJoined, onPeerLeft, handleOffer, handleAnswer, handleIceCandidate, cleanup };
})();
