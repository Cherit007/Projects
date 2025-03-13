import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../index.css"; // Import CSS for styling
import { account } from "../appwriteConfig";
import { ToastContainer } from "react-toastify";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false); // State to track login status
  const navigate = useNavigate();

  // Check if the user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await account.get();
        setIsLoggedIn(true); // User is logged in
      } catch (error) {
        setIsLoggedIn(false); // User is not logged in
      }
    };

    checkAuth();
  }, []);

  // Function to handle logout
  const handleLogout = async () => {
    try {
      await account.deleteSession("current");
      setIsLoggedIn(false); // Update login status
      setTimeout(()=>{
        toast.success("Logout successful! Redirecting...");
      },1000);
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
    <nav className="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">
      <Link
        to="/"
        className="navbar-brand d-flex align-items-center px-4 px-lg-5"
      >
        <h2 className="m-0 text-primary">Community</h2>
      </Link>

      {/* Mobile Menu Toggle Button */}
      <button
        type="button"
        className="navbar-toggler me-4"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        <span className="navbar-toggler-icon"></span>
      </button>

      {/* Navbar Links */}
      <div
        className={`collapse navbar-collapse ${isMenuOpen ? "show" : ""}`}
        id="navbarCollapse"
      >
        <div className="navbar-nav ms-auto p-4 p-lg-0">
          <Link
            to={
              window.location.pathname.includes("admin")
                ? "/admin/dashboard"
                : "/"
            }
            className="nav-item nav-link active"
          >
            Home
          </Link>
          {!window.location.pathname.includes("admin") && (
            <>
              <Link to="/about" className="nav-item nav-link">
                About
              </Link>
              <Link to="/services" className="nav-item nav-link">
                Service
              </Link>
              <Link to="/donate" className="nav-item nav-link">
                Donations
              </Link>
              <Link to="/registration" className="nav-item nav-link">
            Registration
          </Link>
            </>
          )}
          <Link
            to={
              window.location.pathname.includes("admin")
                ? "/admin/member-request"
                : "/members"
            }
            className="nav-link"
          >
            Members
          </Link>
          <Link
            to={
              window.location.pathname.includes("admin")
                ? "/admin/events"
                : "/events"
            }
            className="nav-link"
          >
            Events
          </Link>

          {/* Logout Button (Conditional Rendering) */}
          {isLoggedIn && (
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          )}
          

          {/* Dropdown Menu */}

          {/* Language Toggle Buttons */}
          <div className="translate-buttons">
            <button
              className="translate-btn"
              onClick={() => changeLanguage("en")}
            >
              🇺🇸 English
            </button>
            <button
              className="translate-btn"
              onClick={() => changeLanguage("hi")}
            >
              🇮🇳 हिंदी
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Google Translate Element */}
      <div id="google_translate_element"></div>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </nav>
  );
};


export default Navbar;
