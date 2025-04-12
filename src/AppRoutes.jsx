import { Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import Room from "./pages/Room";
import About from "./pages/About";
import NotFound from "./pages/Notfound";

const AppRoutes = () => {
  const location = useLocation();
  const hideHeader = location.pathname.startsWith("/room");

  return (
    <>
      {!hideHeader && <Header />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default AppRoutes;
