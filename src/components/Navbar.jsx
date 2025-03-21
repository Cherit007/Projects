import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { account } from "../appwriteConfig";
import { toast } from "react-toastify";
import logo from "/img/newlogo.png";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1200); // Check screen width
  const navigate = useNavigate();

  // Check screen width on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1200);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
      setTimeout(() => {
        toast.success("Logout successful! Redirecting...");
      }, 1000);
      navigate("/admin/login");
    } catch (error) {
      toast.error("Failed to log out. Please try again.");
    }
  };

  return (
    <nav
      style={{
        backgroundColor: "#FFD700", // Sky Blue
        padding: "0",
        position: "sticky",
        top: "0",
        zIndex: "1000",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
     <Link to="/" className="navbar-brand d-flex align-items-center">
          <img
            src={logo}
            alt="Community Logo"
            className="navbar-logo"
            style={{
              width: "120px", // Adjust size as needed
              height: "auto",
              maxWidth: "100%",
              borderRadius:"65%"
            }}
          />
        </Link>

      {/* Toggle Button for Mobile */}
      {isMobile && (
        <button
          type="button"
          style={{
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "10px",
            marginRight: "20px",
          }}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <span style={{ fontSize: "24px", color: "#FFFFFF" }}>☰</span>
        </button>
      )}

      {/* Nav Links */}
      <div
        style={{
          display: isMobile ? (isMenuOpen ? "flex" : "none") : "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-end" : "center",
          backgroundColor: isMobile ? "#87CEEB" : "transparent", // Sky Blue for mobile
          padding: isMobile ? "10px" : "0",
          position: isMobile ? "absolute" : "static",
          top: isMobile ? "100%" : "auto",
          right: isMobile ? "0" : "auto",
          width: isMobile ? "100%" : "auto",
          maxWidth: isMobile ? "300px" : "none",
          gap: isMobile ? "0" : "20px", // Space between links for larger screens
        }}
      >
        <Link
          to={isAdmin ? "/admin/dashboard" : "/"}
          style={{
            color: "black", // White
            textDecoration: "none",
            padding: "10px",
            fontSize: "20px",
          }}
        >
        होम
        </Link>
        {!isAdmin && (
          <>
            <Link
              to="/about"
              style={{
                color: "black", // White
                textDecoration: "none",
                padding: "10px",
                fontSize: "20px",
              }}
            >
              परिचय
            </Link>
            <Link
              to="/registration"
              style={{
                color: "black", // White
                textDecoration: "none",
                padding: "10px",
                fontSize: "20px",
              }}
            >
              पंजीकरण
            </Link>
            <Link
              to="/coremembers"
              style={{
                color: "black", // White
                textDecoration: "none",
                padding: "10px",
                fontSize: "20px",
              }}
            >
              मुख्य समुदाय सदस्य
            </Link>
            <Link
              to="/founders"
              style={{
                color: "black", // White
                textDecoration: "none",
                padding: "10px",
                fontSize: "20px",
              }}
            >
              संस्थापक
            </Link>
            <Link
              to="/donate"
              style={{
                color: "black", // White
                textDecoration: "none",
                padding: "10px",
                fontSize: "20px",
              }}
            >
              दान
            </Link>
            <div className="nav-item dropdown">
              <a
                href="#"
                className="nav-link dropdown-toggle"
                style={{
                  color: "black", // White
                  textDecoration: "none",
                  padding: "10px",
                  fontSize: "20px",
                }}
                  data-bs-toggle="dropdown"
              >
                अन्य
              </a>
              <div
                className="dropdown-menu fade-down m-0"
              >
                <Link
                  to="/events"
                  className="dropdown-item"
                >
                  कार्यक्रम
                </Link>
                <Link
                  to="/contactus"
                 className="dropdown-item"
                >
                  हमसे संपर्क करें
                </Link>
              </div>
            </div>
          </>
        )}
        {isAdmin && (
          <>
            <div style={{ position: "relative" }}>
              <a
                href="#"
                className="nav-link dropdown-toggle"
                  data-bs-toggle="dropdown"
              >
                Members
              </a>
              <div
                className="dropdown-menu fade-down m-0"
              >
                <Link
                  to="/admin/member-request"
                  className="dropdown-item"
                >
                  Member Requests
                </Link>
                <Link
                  to="/admin/members"
                  className="dropdown-item"
                >
                  Community Members
                </Link>
              </div>
            </div>
            <Link
              to="/admin/events"
              style={{
                color: "#FFFFFF", // White
                textDecoration: "none",
                padding: "10px",
                fontSize: "20px",
              }}
            >
              Events
            </Link>
          </>
        )}

        {/* Language Buttons */}
        {isMobile && (
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: isMobile ? "10px" : "0",
            }}
          >
            <button
              onClick={() => changeLanguage("en")}
              style={{
                backgroundColor: "#FFD700", // Sunshine Yellow
                color: "#000000", // Black
                border: "none",
                padding: "5px 10px",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              🇺🇸 English
            </button>
            <button
              onClick={() => changeLanguage("hi")}
              style={{
                backgroundColor: "#FFD700", // Sunshine Yellow
                color: "#000000", // Black
                border: "none",
                padding: "5px 10px",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              🇮🇳 हिंदी
            </button>
          </div>
        )}

        {isLoggedIn && isAdmin && (
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: "#FF7F50", // Coral Orange
              color: "#FFFFFF", // White
              border: "none",
              padding: "10px 20px",
              borderRadius: "5px",
              cursor: "pointer",
              marginTop: isMobile ? "10px" : "0",
            }}
          >
            Logout
          </button>
        )}
      </div>

      {/* Language Buttons for Larger Screens */}
      {!isMobile && (
        <div
          style={{
            display: isMobile ? (isMenuOpen ? "flex" : "none") : "flex",
            marginLeft: "10px",
            alignItems:"center",
            // marginBottom: "26px",
            gap: "10px",
          }}
        >
          <button
            onClick={() => changeLanguage("en")}
            style={{
              backgroundColor: "#FFD700", // Sunshine Yellow
              color: "#000000", // Black
              border: "none",
              padding: "5px 10px",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            🇺🇸 English
          </button>
          <button
            onClick={() => changeLanguage("hi")}
            style={{
              backgroundColor: "#FFD700", // Sunshine Yellow
              color: "#000000", // Black
              border: "none",
              padding: "5px 10px",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            🇮🇳 हिंदी
          </button>
        </div>
      )}

      {/* Hidden Google Translate Element */}
      <div id="google_translate_element" style={{ display: "none" }}></div>
    </nav>
  );
};

export default Navbar;
