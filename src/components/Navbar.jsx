import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../index.css"; // Import CSS for styling
import { account } from "../appwriteConfig";
import { toast } from "react-toastify";
import logo from "/img/newlogo.png";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  // Check if the user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await account.get();
        if (
          user.labels.includes("admin") &&
          window.location.pathname.includes("admin")
        ) {
          setIsAdmin(true);
          navigate("/admin/dashboard");
        } else setIsAdmin(false);
        setIsLoggedIn(true);
      } catch (error) {
        setIsAdmin(false);
        setIsLoggedIn(false);
      }
    };
    checkAuth();
  }, []);

  // Function to handle logout
  const handleLogout = async () => {
    try {
      await account.deleteSession("current");
      setIsLoggedIn(false);
      toast.success("Logout successful! Redirecting...");
      navigate("/admin/login");
    } catch (error) {
      toast.error("Failed to log out. Please try again.");
    }
  };

  return (
    <nav className="navbar navbar-expand-lg bg-white navbar-light sticky-top p-2">
      <div className="container-fluid">
        {/* Logo */}
        <Link to="/" className="navbar-brand d-flex align-items-center">
          <img
            src={logo}
            alt="Community Logo"
            className="navbar-logo"
            style={{
              width: "120px", // Adjust size as needed
              height: "auto",
              maxWidth: "100%",
            }}
          />
        </Link>

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          className="navbar-toggler"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Navbar Links */}
        <div
          className={`collapse navbar-collapse ${isMenuOpen ? "show" : ""}`}
          id="navbarCollapse"
        >
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <Link to={isAdmin ? "/admin/dashboard" : "/"} className="nav-link">
                Home
              </Link>
            </li>
            {!isAdmin && (
              <>
                <li className="nav-item">
                  <Link to="/about" className="nav-link">About</Link>
                </li>
                <li className="nav-item">
                  <Link to="/registration" className="nav-link">Registration</Link>
                </li>
                <li className="nav-item">
                  <Link to="/coremembers" className="nav-link">Core Community Members</Link>
                </li>
                <li className="nav-item">
                  <Link to="/donate" className="nav-link">Donations</Link>
                </li>
                <li className="nav-item dropdown">
                  <a
                    href="#"
                    className="nav-link dropdown-toggle"
                    data-bs-toggle="dropdown"
                  >
                    Others
                  </a>
                  <ul className="dropdown-menu">
                    <li><Link to="/events" className="dropdown-item">Events</Link></li>
                    <li><Link to="/contactus" className="dropdown-item">Contact Us</Link></li>
                  </ul>
                </li>
              </>
            )}
            {isAdmin && (
              <>
                <li className="nav-item dropdown">
                  <a href="#" className="nav-link dropdown-toggle" data-bs-toggle="dropdown">
                    Members
                  </a>
                  <ul className="dropdown-menu">
                    <li><Link to="/admin/member-request" className="dropdown-item">Member Requests</Link></li>
                    <li><Link to="/admin/members" className="dropdown-item">Community Members</Link></li>
                  </ul>
                </li>
                <li className="nav-item">
                  <Link to="/admin/events" className="nav-link">Events</Link>
                </li>
              </>
            )}

            {/* Logout Button */}
            {isLoggedIn && isAdmin && (
              <li className="nav-item">
                <button onClick={handleLogout} className="btn btn-danger ms-3">
                  Logout
                </button>
              </li>
            )}
          </ul>

          {/* Language Toggle Buttons */}
          <div className="d-flex align-items-center ms-3">
            <button className="btn btn-sm btn-secondary mx-1">🇺🇸 English</button>
            <button className="btn btn-sm btn-secondary mx-1">🇮🇳 हिंदी</button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
