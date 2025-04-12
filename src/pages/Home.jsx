import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import bannerBg from "/videobg.jpg";

const Home = () => {
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }

    const id = uuidv4();

    try {
      await axios.post("http://localhost:5000/create-room", { roomId: id });
      navigate(`/room/${id}`, { state: { name } });
    } catch (error) {
      console.error(error);
      setError("Failed to create room. Try again.");
    }
  };

  const handleJoinRoom = async () => {
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!roomId.trim()) {
      setError("Please enter a room ID to join");
      return;
    }

    try {
      const res = await axios.get(`http://localhost:5000/check-room/${roomId}`);
      if (res.data.exists) {
        navigate(`/room/${roomId}`, { state: { name } });
      } else {
        setError("Room does not exist, please check the ID.");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Try again later.");
    }
  };

  return (
    <>
      <section className="py-20 max-lg:pt-26 lg:h-screen flex items-center">
        <div className="container">
          <div className="flex items-center -mx-4 flex-wrap">
            <div className="w-full px-4 lg:w-1/2">
              <div className="max-w-96">
                <h1 className="text-3xl lg:text-4xl text-black font-bold mb-5">
                  Video calls and meetings for everyone
                </h1>
                <p className="text-base text-gray-600 mb-4">
                  Connect, collaborate and celebrate from anywhere with VideoCL
                </p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                  className="w-full h-11 bg-white border border-solid border-site px-3 py-2 rounded-sm focus:outline-0"
                  placeholder="Enter Your Name"
                />

                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => {
                    setRoomId(e.target.value);
                    setError("");
                  }}
                  className="w-full h-11 bg-white border mt-3 border-solid border-site px-3 py-2 rounded-sm focus:outline-0"
                  placeholder="Enter Room ID (for joining)"
                />

                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

                <div className="flex gap-3.5 mt-6">
                  <button
                    onClick={handleCreateRoom}
                    className="bg-site text-white px-4 py-2 rounded cursor-pointer"
                  >
                    Create Room
                  </button>
                  <button
                    onClick={handleJoinRoom}
                    className="bg-black text-white px-4 py-2 rounded cursor-pointer"
                  >
                    Join Room
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full px-4 lg:w-1/2 max-lg:mt-16">
              <img src={bannerBg} className="w-full block" alt="bg" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Home;
