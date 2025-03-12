// import React, { useState } from "react";
// import { Link } from "react-router-dom";
// import "../index.css"; // Add CSS for styling

// const Navbar = () => {
//   const [isMenuOpen, setIsMenuOpen] = useState(false);
//   const [isDropdownOpen, setIsDropdownOpen] = useState(false);

//   const toggleMenu = () => {
//     setIsMenuOpen(!isMenuOpen);
//   };

//   const toggleDropdown = () => {
//     setIsDropdownOpen(!isDropdownOpen);
//   };

//   return (
//     <nav className="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">
//       <Link to="/" className="navbar-brand d-flex align-items-center px-4 px-lg-5">
//         <h2 className="m-0 text-primary">WooDY</h2>
//       </Link>

//       {/* Mobile Menu Toggle Button */}
//       <button
//         type="button"
//         className="navbar-toggler me-4"
//         onClick={toggleMenu}
//       >
//         <span className="navbar-toggler-icon"></span>
//       </button>

//       {/* Navbar Links */}
//       <div className={`collapse navbar-collapse ${isMenuOpen ? "show" : ""}`} id="navbarCollapse">
//         <div className="navbar-nav ms-auto p-4 p-lg-0">
//           <Link to="/" className="nav-item nav-link active">
//             Home
//           </Link>
//           <Link to="/about" className="nav-item nav-link">
//             About
//           </Link>
//           <Link to="/services" className="nav-item nav-link">
//             Service
//           </Link>
//           <Link to="/projects" className="nav-item nav-link">
//             Project
//           </Link>
//           <Link to="/events" className="nav-link">Events</Link>


//           {/* Dropdown Menu */}
//           <div className="nav-item dropdown">
//             <a
//               href="#"
//               className="nav-link dropdown-toggle"
//               onClick={toggleDropdown}
//             >
//               Pages
//             </a>
//             <div className={`dropdown-menu fade-up m-0 ${isDropdownOpen ? "show" : ""}`}>
//               <Link to="/feature" className="dropdown-item">
//                 Feature
//               </Link>
//               <Link to="/quote" className="dropdown-item">
//                 Free Quote
//               </Link>
//               <Link to="/team" className="dropdown-item">
//                 Our Team
//               </Link>
//               <Link to="/testimonials" className="dropdown-item">
//                 Testimonial
//               </Link>
//               <Link to="/404" className="dropdown-item">
//                 404 Page
//               </Link>
//             </div>
//           </div>

//           <Link to="/contact" className="nav-item nav-link">
//             Contact
//           </Link>
//         </div>

//       </div>
//     </nav>
//   );
// };

// export default Navbar;

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "../index.css"; // Import CSS for styling

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // Load Google Translate Script Only Once
    const existingScript = document.getElementById("google-translate-script");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.src =
        "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    }

    // Initialize Google Translate Widget
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

  // Function to Change Language
  const changeLanguage = (lang) => {
    const select = document.querySelector(".goog-te-combo");
    if (select) {
      select.value = lang; // Set the selected language
      select.dispatchEvent(new Event("change")); // Trigger translation
    }
  };

  return (
    <nav className="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">
      <Link to="/" className="navbar-brand d-flex align-items-center px-4 px-lg-5">
        <h2 className="m-0 text-primary">WooDY</h2>
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
      <div className={`collapse navbar-collapse ${isMenuOpen ? "show" : ""}`} id="navbarCollapse">
        <div className="navbar-nav ms-auto p-4 p-lg-0">
          <Link to="/" className="nav-item nav-link active">
            Home
          </Link>
          <Link to="/about" className="nav-item nav-link">
            About
          </Link>
          <Link to="/services" className="nav-item nav-link">
            Service
          </Link>
          <Link to="/donate" className="nav-item nav-link">
            Donations
          </Link>
          <Link to="/events" className="nav-link">Events</Link>
          <Link to="/members" className="nav-link">Members</Link>
          <Link to="/admin" className="nav-link">Login</Link>

          {/* Dropdown Menu */}          

          {/* Language Toggle Button */}
          <div className="translate-buttons">
            <button className="translate-btn" onClick={() => changeLanguage("en")}>
              🇺🇸 English
            </button>
            <button className="translate-btn" onClick={() => changeLanguage("hi")}>
              🇮🇳 हिंदी
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Google Translate Element */}
      <div id="google_translate_element"></div>
    </nav>
  );
};

export default Navbar;
