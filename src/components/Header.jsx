import React from "react";

const Header = () => {
  return (
    <div className="container-fluid p-0">
      <div className="owl-carousel header-carousel position-relative">
        <div className="owl-carousel-item position-relative">
          <img className="img-fluid" src="img/carousel-1.jpg" alt="" />
          <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center" style={{ background: "rgba(53, 53, 53, .7)" }}>
            <div className="container">
              <div className="row justify-content-center">
                <div className="col-12 col-lg-8 text-center">
                  <h5 className="text-white text-uppercase mb-3 animated slideInDown">Welcome To WooDY</h5>
                  <h1 className="display-3 text-white animated slideInDown mb-4">Best Carpenter & Craftsman Services</h1>
                  <p className="fs-5 fw-medium text-white mb-4 pb-2">Vero elitr justo clita lorem. Ipsum dolor at sed stet sit diam no. Kasd rebum ipsum et diam justo clita et kasd rebum sea elitr.</p>
                  <a href="" className="btn btn-primary py-md-3 px-md-5 me-3 animated slideInLeft">Read More</a>
                  <a href="" className="btn btn-light py-md-3 px-md-5 animated slideInRight">Free Quote</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;