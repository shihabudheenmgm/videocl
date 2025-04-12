import { Link, NavLink } from "react-router-dom";
import logo from "/logo.svg";

const menuitems = [
  {
    url: "/",
    title: "Home",
  },
  {
    url: "/about",
    title: "About",
  },
];

const Header = () => {
  return (
    <>
      <header className="fixed top-0 left-0 right-0">
        <nav className="py-6">
          <div className="container flex justify-between">
            <div className="logo max-w-36">
              <Link to={"/"}>
                <img src={logo} className="w-full block" alt="logo" />
              </Link>
            </div>
            <ul className="flex items-center gap-8">
              {menuitems.map((menu, index) => (
                <li key={index}>
                  <NavLink to={menu.url} className="">
                    <span className="text-lg text-black hover:text-site">
                      {menu.title}
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>
    </>
  );
};

export default Header;
