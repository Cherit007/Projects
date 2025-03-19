import React from "react";

const Footer = () => {
  return (
    <div className="footer-container">
      <div className="footer-column">
        <h4 className="footer-heading">Address</h4>
        <p>
          <i className="fa fa-map-marker-alt icon"></i>Madhya Pradesh, India
        </p>
        <p>
          <i className="fa fa-phone-alt icon"></i>+91 91110 97070
        </p>
        <div className="social-icons">
          <a
            target="_blank"
            rel="noopener noreferrer"
            className="social-button"
            href="https://www.facebook.com/SajjanVermaOfficial/about_profile_transparency"
          >
            <i className="fab fa-twitter"></i>
          </a>
          <a
            target="_blank"
            rel="noopener noreferrer"
            className="social-button"
            href="https://x.com/sajjanvermainc?lang=en"
          >
            <i className="fab fa-facebook-f"></i>
          </a>
        </div>
      </div>

      <div className="footer-column">
        <h4 className="footer-heading">Quick Links</h4>
        <a className="footer-link" href="/about">
          About Us
        </a>
        <a className="footer-link" href="/contactus">
          Contact Us
        </a>
        <a className="footer-link" href="/donate">
          Donations
        </a>
        <a className="footer-link" href="/events">
          Events
        </a>
        <a className="footer-link" href="/coremembers">
          Core Members
        </a>
      </div>
    </div>
  );
};

export default Footer;
