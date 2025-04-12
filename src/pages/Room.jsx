import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faMicrophoneSlash,
  faPlay,
  faPause,
  faMessage,
  faPhoneSlash,
  faPaperPlane,
} from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import io from "socket.io-client";

const Room = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomId } = useParams();
  const userName = location.state?.name;

  const localVideoRef = useRef(null);
  const videoWrapRef = useRef(null);
  const peerConnections = useRef({});
  const socket = useRef(null);
  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [showChat, setShowChat] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isPlayPause, setIsPlayPause] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const remoteVideoRefs = useRef({});

  // Debounce function
  const debounce = (func, wait) => {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  };

  const [videoDimensions, setVideoDimensions] = useState({
    width: 0,
    height: 0,
    cols: 1,
  });

  const calculateVideoLayout = useCallback(() => {
    if (!videoWrapRef.current) return;

    const container = videoWrapRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const participantCount = participants.length + 1;
    const gapSize = 12;

    if (participantCount === 1) {
      setVideoDimensions({
        width: containerWidth,
        height: containerHeight,
        cols: 1,
      });
      return;
    }

    let bestLayout = { cols: 1, width: 0, height: 0 };
    const maxColumns = Math.min(participantCount, 4);

    for (let cols = 1; cols <= maxColumns; cols++) {
      const rows = Math.ceil(participantCount / cols);
      const width = (containerWidth - gapSize * (cols - 1)) / cols;
      const height = width * (9 / 16);
      const totalHeight = height * rows + gapSize * (rows - 1);

      if (totalHeight <= containerHeight && width > bestLayout.width) {
        bestLayout = { cols, width, height };
      }
    }

    if (bestLayout.width === 0) {
      const cols = Math.ceil(Math.sqrt(participantCount));
      const width = (containerWidth - gapSize * (cols - 1)) / cols;
      bestLayout = {
        cols,
        width,
        height: width * (9 / 16),
      };
    }

    setVideoDimensions(bestLayout);
  }, [participants]);

  const createPeerConnection = (userId, stream) => {
    if (peerConnections.current[userId]) {
      return peerConnections.current[userId];
    }

    const pc = new RTCPeerConnection();

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.current.emit("ice-candidate", {
          to: userId,
          candidate: e.candidate,
        });
      }
    };

    pc.ontrack = (e) => {
      if (!remoteStreams[userId]) {
        setRemoteStreams((prev) => ({ ...prev, [userId]: e.streams[0] }));
      }

      const updateVideo = () => {
        const videoElement = remoteVideoRefs.current[userId];
        if (videoElement && e.streams[0]) {
          videoElement.srcObject = e.streams[0];
        } else {
          requestAnimationFrame(updateVideo);
        }
      };
      updateVideo();
    };

    peerConnections.current[userId] = pc;

    if (!pc.currentRemoteDescription) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socket.current.emit("offer", {
            to: userId,
            offer: pc.localDescription,
          });
        })
        .catch(console.error);
    }

    return pc;
  };

  const toggleMic = () => {
    const audioTrack = localStream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    const videoTrack = localStream?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsPlayPause(videoTrack.enabled);
    }
  };

  const disconnectCall = () => {
    if (participants.length === 0) {
      socket.current.emit("end-room", roomId);
    } else {
      socket.current.emit("leave-room", roomId);
    }
    navigate("/");
  };

  useEffect(() => {
    socket.current = io("http://localhost:5000");

    const initLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localVideoRef.current.srcObject = stream;
        setLocalStream(stream);

        setParticipants([]);
        Object.values(peerConnections.current).forEach((pc) => pc.close());
        peerConnections.current = {};
        setRemoteStreams({});

        socket.current.emit("join-room", { roomId, name: userName });

        socket.current.on("all-users", (users) => {
          const newParticipants = users
            .filter(
              ({ id }) =>
                id !== socket.current.id && !peerConnections.current[id]
            )
            .map(({ id, name }) => {
              createPeerConnection(id, stream);
              return { id, name };
            });

          setParticipants(newParticipants);
        });

        socket.current.on("user-joined", ({ id, name }) => {
          if (id !== socket.current.id && !peerConnections.current[id]) {
            createPeerConnection(id, stream);
            setParticipants((prev) => [...prev, { id, name }]);
          }
        });

        socket.current.on("user-disconnected", (id) => {
          if (peerConnections.current[id]) {
            peerConnections.current[id].close();
            delete peerConnections.current[id];
          }
          setParticipants((prev) => prev.filter((p) => p.id !== id));
          setRemoteStreams((prev) => {
            const newStreams = { ...prev };
            delete newStreams[id];
            return newStreams;
          });
        });

        socket.current.on("offer", async ({ from, offer }) => {
          const pc = createPeerConnection(from, stream);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.current.emit("answer", { to: from, answer });
        });

        socket.current.on("answer", ({ from, answer }) => {
          const pc = peerConnections.current[from];
          if (pc) pc.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socket.current.on("ice-candidate", ({ from, candidate }) => {
          const pc = peerConnections.current[from];
          if (pc && candidate) {
            pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        });
      } catch (err) {
        console.error("Failed to access media devices:", err);
      }
    };

    initLocalStream();

    return () => {
      socket.current.emit("leave-room", roomId);
      Object.values(peerConnections.current).forEach((pc) => pc.close());
      socket.current.disconnect();
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, [roomId, userName]);

  const debouncedResize = useMemo(
    () => debounce(calculateVideoLayout, 100),
    [calculateVideoLayout]
  );

  useEffect(() => {
    // Initial calculation
    calculateVideoLayout();

    window.addEventListener("resize", debouncedResize);
    return () => {
      window.removeEventListener("resize", debouncedResize);
      debouncedResize.cancel?.();
    };
  }, [calculateVideoLayout, debouncedResize]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      calculateVideoLayout();
    });

    if (videoWrapRef.current) {
      observer.observe(videoWrapRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [calculateVideoLayout]);

  useEffect(() => {
    return () => {
      Object.keys(remoteVideoRefs.current).forEach((id) => {
        if (remoteVideoRefs.current[id]?.srcObject) {
          remoteVideoRefs.current[id].srcObject = null;
        }
      });
      remoteVideoRefs.current = {};
    };
  }, []);

  return (
    <section className="h-dvh w-full bg-black text-white px-6 pt-10 pb-26 relative">
      <div className="text-sm absolute top-0 left-0 right-0 w-ful bg-black py-2 px-6 z-10">
        Room ID: {roomId}
      </div>
      <div className="flex h-full gap-4">
        <div
          className={`transition-all duration-300 size-full flex items-center justify-center ${
            showChat ? "w-3/4" : "w-full"
          }`}
        >
          <div className="size-full flex flex-wrap gap-4" ref={videoWrapRef}>
            <div className="flex items-center justify-center">
              <div
                className="relative"
                style={{
                  width: videoDimensions.width,
                  height: videoDimensions.height,
                }}
              >
                <div className="text-sm font-semibold absolute top-2 left-2 bg-gray-600 rounded-xl px-3 py-1">
                  {userName}
                </div>
                <video
                  autoPlay
                  muted
                  playsInline
                  ref={localVideoRef}
                  className="rounded size-full object-cover bg-black"
                />
              </div>
            </div>
            {participants.map((participant) => (
              <div
                className="flex items-center justify-center"
                key={`participant-${participant.id}`}
              >
                <div
                  className="relative"
                  style={{
                    width: videoDimensions.width,
                    height: videoDimensions.height,
                  }}
                >
                  <div className="text-sm font-semibold absolute top-2 left-2 bg-black rounded-xl px-3 py-1">
                    {participant.name}
                  </div>
                  <video
                    autoPlay
                    playsInline
                    ref={(el) => (remoteVideoRefs.current[participant.id] = el)}
                    className="rounded size-full object-cover bg-black"
                    onError={(e) => console.error("Video error:", e)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {showChat && (
          <div className="max-lg:absolute max-lg:right-3 max-lg:bottom-20 max-lg:w-2/3 max-lg:h-[80%] w-1/4 bg-gray-900 p-4 rounded-lg flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              <p className="text-right">
                <span className="inline-block bg-gray-500 px-3 py-1 rounded-lg">
                  Message
                </span>
              </p>
              <p>
                <span className="inline-block bg-gray-800 px-3 py-1 rounded-lg">
                  Reply Message
                </span>
              </p>
            </div>
            <div className="flex">
              <input
                className="flex-1 bg-gray-800 px-3 py-2 text-white rounded-l focus:outline-none"
                placeholder="Type a message..."
              />
              <button className="bg-blue-600 px-4 rounded-r">
                <FontAwesomeIcon icon={faPaperPlane} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex gap-3 lg:absolute inset-0 lg:m-auto items-center justify-center max-w-3xs">
          <button
            className="p-2 rounded cursor-pointer hover:bg-black/10"
            onClick={toggleMic}
          >
            <FontAwesomeIcon
              className="w-7"
              icon={isMicOn ? faMicrophone : faMicrophoneSlash}
            />
          </button>
          <button
            className="p-2 rounded cursor-pointer hover:bg-black/10"
            onClick={toggleCamera}
          >
            <FontAwesomeIcon
              className="w-7"
              icon={isPlayPause ? faPause : faPlay}
            />
          </button>
          <button
            className="bg-red-700 px-4 py-2 rounded cursor-pointer hover:bg-red-600"
            onClick={disconnectCall}
          >
            <FontAwesomeIcon icon={faPhoneSlash} />
          </button>
        </div>
        <div className="flex gap-3 ml-auto">
          <button
            className="bg-gray-600 px-4 py-2 rounded cursor-pointer hover:bg-gray-500"
            onClick={() => setShowChat(!showChat)}
          >
            <FontAwesomeIcon icon={faMessage} />
          </button>
        </div>
      </div>
    </section>
  );
};

export default Room;
