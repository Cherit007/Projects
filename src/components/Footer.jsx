import React from "react";

const Footer = () => {
  return (
    <div
      className="container-fluid bg-dark text-light footer mt-5 pt-5 wow fadeIn"
      data-wow-delay="0.1s"
    >
      <div className="footer-container">
        <div className="col-lg-3 col-md-6">
          <h4 className="text-light mb-4">Address</h4>
          <p className="mb-2">
            <i className="fa fa-map-marker-alt me-3"></i>Madhya Pradesh, India
          </p>
          <p className="mb-2">
            <i className="fa fa-phone-alt me-3"></i>+91 91110 97070
          </p>
          {/* <p className="mb-2">
              <i className="fa fa-envelope me-3"></i>info@example.com
            </p> */}
          <div className="d-flex pt-2">
            <a
              target="_blank"
              className="btn btn-outline-light btn-social"
              href="https://www.facebook.com/SajjanVermaOfficial/about_profile_transparency"
            >
              <i className="fab fa-twitter"></i>
            </a>
            <a
              target="_blank"
              className="btn btn-outline-light btn-social"
              href="https://x.com/sajjanvermainc?lang=en"
            >
              <i className="fab fa-facebook-f"></i>
            </a>
            {/* <a className="btn btn-outline-light btn-social" href="">
                <i className="fab fa-youtube"></i>
              </a>
              <a className="btn btn-outline-light btn-social" href="">
                <i className="fab fa-linkedin-in"></i>
              </a> */}
          </div>
        </div>
        <div className="col-lg-3 col-md-6">
          <h4 className="text-light mb-4">Quick Links</h4>
          <a className="btn btn-link" href="/about">
            About Us
          </a>
          <a className="btn btn-link" href="/contactus">
            Contact Us
          </a>
          <a className="btn btn-link" href="/donate">
            Donations
          </a>
          <a className="btn btn-link" href="/events">
            Events
          </a>
          <a className="btn btn-link" href="/coremembers">
            Core Members
          </a>
        </div>
      </div>
    </div>
  );
};

export default Footer;
