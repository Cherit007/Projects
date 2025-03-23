import React from "react";

const Footer = () => {
  return (
    <div className="footer-container">
      <div className="footer-column">
        <h4 className="footer-heading">पता</h4>
        <p>
          <i className="fa fa-map-marker-alt icon"></i>ग्रैंड ट्रंक रोड, चाँदपुर, लेहर्टारा इंडस्ट्रियल एस्टेट, वाराणसी, उत्तर प्रदेश 221106
        </p>
        <p>
          <i className="fa fa-phone-alt icon"></i>+91 91110 97070
        </p>
        <div className="social-icons">
          <a
            target="_blank"
            rel="noopener noreferrer"
            className="social-button"
            href="https://x.com/"
          >
            <i className="fab fa-twitter"></i>
          </a>
          <a
            target="_blank"
            rel="noopener noreferrer"
            className="social-button"
            href="https://www.facebook.com/"
          >
            <i className="fab fa-facebook-f"></i>
          </a>
          <a
            target="_blank"
            rel="noopener noreferrer"
            className="social-button"
            href="https://www.instagram.com/"
          >
            <i className="fab fa-instagram"></i>
          </a>
          <a
            target="_blank"
            rel="noopener noreferrer"
            className="social-button"
            href="https://www.youtube.com/"
          >
            <i className="fab fa-youtube"></i>
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