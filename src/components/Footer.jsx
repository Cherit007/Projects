import React from "react";

const Footer = () => {
  return (
    <div className="footer-container">
      <div className="footer-column">
        <h4 className="footer-heading">पता</h4>
        <p>
          <i className="fa fa-map-marker-alt icon"></i>मध्य प्रदेश, भारत
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
        <h4 className="footer-heading">त्वरित लिंक</h4>
        <a className="footer-link" href="/about">
          हमारे बारे में
        </a>
        <a className="footer-link" href="/contactus">
          संपर्क करें
        </a>
        <a className="footer-link" href="/donate">
          दान
        </a>
        <a className="footer-link" href="/events">
          आयोजन
        </a>
        <a className="footer-link" href="/coremembers">
          मुख्य सदस्य
        </a>
      </div>
    </div>
  );
};

export default Footer;