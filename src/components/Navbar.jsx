import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { account } from "../appwriteConfig";
import { toast, ToastContainer } from "react-toastify";
import logo from "/img/logo.jpg";

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
        console.log(user, "user");
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
      console.error("Error during logout:", error);
      toast.error("Failed to log out. Please try again.");
    }
  };

  // Load Google Translate Script
  useEffect(() => {
    const existingScript = document.getElementById("google-translate-script");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.src =
        "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    }

    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: "en,hi",
          autoDisplay: false,
        },
        "google_translate_element"
      );
    };
  }, []);

  // Function to change language
  const changeLanguage = (lang) => {
    const select = document.querySelector(".goog-te-combo");
    if (select) {
      select.value = lang;
      select.dispatchEvent(new Event("change"));
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
      <Link
        to="/"
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          textDecoration: "none",
        }}
      >
        <img
          src={logo}
          alt="Community Logo"
          style={{
            width: "75px",
            height: "75px",
            borderRadius: "50%",
            marginRight: "10px",
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
            fontSize: "16px",
          }}
        >
          Home
        </Link>
        {!isAdmin && (
          <>
            <Link
              to="/about"
              style={{
                color: "black", // White
                textDecoration: "none",
                padding: "10px",
                fontSize: "16px",
              }}
            >
              About
            </Link>
            <Link
              to="/registration"
              style={{
                color: "black", // White
                textDecoration: "none",
                padding: "10px",
                fontSize: "16px",
              }}
            >
              Registration
            </Link>
            <Link
              to="/coremembers"
              style={{
                color: "black", // White
                textDecoration: "none",
                padding: "10px",
                fontSize: "16px",
              }}
            >
              Core Community Members
            </Link>
            <Link
              to="/donate"
              style={{
                color: "black", // White
                textDecoration: "none",
                padding: "10px",
                fontSize: "16px",
              }}
            >
              Donations
            </Link>
            <div className="nav-item dropdown">
              <a
                href="#"
                className="nav-link dropdown-toggle"
                style={{
                  color: "black", // White
                  textDecoration: "none",
                  padding: "10px",
                  fontSize: "16px",
                }}
                  data-bs-toggle="dropdown"
              >
                Others
              </a>
              <div
                className="dropdown-menu fade-down m-0"
              >
                <Link
                  to="/events"
                  className="dropdown-item"
                >
                  Events
                </Link>
                <Link
                  to="/contactus"
                 className="dropdown-item"
                >
                  Contact Us
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
                fontSize: "16px",
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
