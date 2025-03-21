import React, { useEffect } from "react";
import {
  MapPin,
  Clock,
  Phone,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
} from "lucide-react";
import "../index.css";
import Navbar from "./Navbar";

const Header = () => {
  return (
    <div>
      <div className="header-container">
        <div className="header-content">
          <div className="left-section">
            <div className="info-item">
              <MapPin className="icon primary-icon" />
              <small>मध्य प्रदेश</small>
            </div>
            <div className="info-item">
              <Clock className="icon primary-icon" />
              <small>Mon - Fri : 09.00 AM - 09.00 PM</small>
            </div>
          </div>
          <div className="right-section">
            <div className="info-item">
              <Phone className="icon primary-icon" />
              <small>+91 91110 97070</small>
            </div>
            <div className="social-icons">
              <a target="_blank" className="social-icon-link" href="https://www.facebook.com/SajjanVermaOfficial/about_profile_transparency">
                <Facebook className="icon" />
              </a>
              <a target="_blank" className="social-icon-link" href="https://x.com/sajjanvermainc?lang=en">
                <Twitter className="icon" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div id="google_translate_element" className="translate-widget"></div>
      <Navbar />
    </div>
  );
};

export default Header;
