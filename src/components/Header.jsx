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
              <small>123 Street, New York, USA</small>
            </div>
            <div className="info-item">
              <Clock className="icon primary-icon" />
              <small>Mon - Fri : 09.00 AM - 09.00 PM</small>
            </div>
          </div>
          <div className="right-section">
            <div className="info-item">
              <Phone className="icon primary-icon" />
              <small>+012 345 6789</small>
            </div>
            <div className="social-icons">
              <a className="social-icon-link" href="">
                <Facebook className="icon" />
              </a>
              <a className="social-icon-link" href="">
                <Twitter className="icon" />
              </a>
              <a className="social-icon-link" href="">
                <Linkedin className="icon" />
              </a>
              <a className="social-icon-link" href="">
                <Instagram className="icon" />
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
