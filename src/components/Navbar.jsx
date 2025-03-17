import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../index.css"; // Import CSS for styling
import { account } from "../appwriteConfig";
import { toast, ToastContainer } from "react-toastify";
import logo from '/img/logo.jpg';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false); // State to track login status
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  // Check if the user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await account.get();
        console.log(user, "user");
        if (user.labels.includes("admin") && window.location.pathname.includes("admin")) {
          setIsAdmin(true);
          navigate("/admin/dashboard");
        } else setIsAdmin(false);
        setIsLoggedIn(true); // User is logged in
      } catch (error) {
        setIsAdmin(false);
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
      script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
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
      <Link to="/" className="navbar-brand d-flex align-items-center px-4 px-lg-5">
        <img
          src={logo}
          alt="Community Logo"
          style={{ width: "80px", height: "80px", borderRadius: "50%", marginRight: "10px" }}
        />
      </Link>

      <button type="button" className="navbar-toggler me-4" onClick={() => setIsMenuOpen(!isMenuOpen)}>
        <span className="navbar-toggler-icon"></span>
      </button>

      <div className={`collapse navbar-collapse ${isMenuOpen ? "show" : ""}`} id="navbarCollapse">
        <div className="navbar-nav ms-auto p-4 p-lg-0">
          <Link to="/" className="nav-item nav-link active">Home</Link>
          <Link to="/about" className="nav-item nav-link">About</Link>
          <Link to="/registration" className="nav-item nav-link">Registration</Link>
          {isAdmin && <Link to="/admin/members" className="nav-item nav-link">Members</Link>}
          <Link to="/donate" className="nav-item nav-link">Donations</Link>
          
          <div className="nav-item dropdown">
            <a href="#" className="nav-link dropdown-toggle" data-bs-toggle="dropdown">Others</a>
            <div className="dropdown-menu fade-down m-0">
              <Link to="/events" className="dropdown-item">Events</Link>
              <Link to="/contactus" className="dropdown-item">Contact Us</Link>
            </div>
          </div>

          {isLoggedIn && isAdmin && (
            <button onClick={handleLogout} className="logout-button">Logout</button>
          )}
        </div>

        {/* Language Toggle Buttons */}
        <div className="translate-buttons" style={{ marginLeft: "10px",marginBottom:"26px" }}>
          <button className="translate-btn btn btn-sm btn-secondary mx-1" onClick={() => changeLanguage("en")}>🇺🇸 English</button>
          <button className="translate-btn btn btn-sm btn-secondary mx-1" onClick={() => changeLanguage("hi")}>🇮🇳 हिंदी</button>
        </div>
      </div>
      
      {/* Hidden Google Translate Element */}
      <div id="google_translate_element" style={{ display: "none" }}></div>
    </nav>
  );
};

export default Navbar;
