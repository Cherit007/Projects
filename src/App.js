// import "./custom.css";
import { useEffect, useRef, useState } from "react";
import Marquee from "react-marquee-slider";
import times from "lodash/times"; // Optional, just for repeating logos if needed

function App() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
    phoneNo: "",
  });
  const [mailStatus, setMailStatus] = useState(false);
  const [error, setError] = useState(false);

  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = () => {
    if (window.pageYOffset > 20) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    window.addEventListener("scroll", toggleVisibility);
    return () => {
      window.removeEventListener("scroll", toggleVisibility);
    };
  }, []);
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const logos = [
    { url: "images/ccl.jpeg", alt: "Company 1" },
    { url: "images/gayatri.jpeg", alt: "Company 1" },
    { url: "images/larsen.jpeg", alt: "Company 1" },
    { url: "images/meil.jpeg", alt: "Company 1" },
    { url: "images/orient.jpeg", alt: "Company 1" },
    { url: "images/penna.jpeg", alt: "Company 1" },
    { url: "images/shapoorji.jpeg", alt: "Company 1" },
    { url: "images/tata.jpeg", alt: "Company 1" },
    { url: "images/thermal.jpeg", alt: "Company 1" },
    { url: "images/wbi.jpeg", alt: "Company 1" },
  ];

  const products = [
    { url: "images/product1.jpeg", alt: "Company 1" },
    { url: "images/product2.jpeg", alt: "Company 1" },
    { url: "images/product3.jpeg", alt: "Company 1" },
    { url: "images/product4.jpeg", alt: "Company 1" },
    { url: "images/product5.jpeg", alt: "Company 1" },
    { url: "images/product6.jpeg", alt: "Company 1" },
    { url: "images/product7.jpeg", alt: "Company 1" },
    { url: "images/product8.jpeg", alt: "Company 1" },
    { url: "images/product9.jpeg", alt: "Company 1" },
    { url: "images/product10.jpeg", alt: "Company 1" },
    { url: "images/product11.jpeg", alt: "Company 1" },
  ];

  const handleSendEmail = async (e) => {
    e.preventDefault();
    try {
      if (!formData.name || !formData.email || !formData.phoneNo) {
        setError(true);
        return;
      }
      setError(false);
      const response = await fetch(
        "https://mail-service-ike3.onrender.com/submit-form",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      if (response.ok) {
        const result = await response.json();
        setMailStatus(true);
        console.log("Form successfully submitted:", result);
        setFormData({
          name: "",
          email: "",
          message: "",
          phoneNo: "",
        });
        setTimeout(() => {
          setMailStatus(false);
        }, 2000);
      } else {
        console.error("Form submission failed:", response.statusText);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    }
    console.log(formData);
  };
  return (
    <div classNameName="App">
      <header>
        <nav className="navbar bootsnav">
          <div className="top-search">
            <div className="container">
              <div className="input-group">
                <span className="input-group-addon">
                  <i className="fa fa-search"></i>
                </span>
                <span className="input-group-addon close-search">
                  <i className="fa fa-times"></i>
                </span>
              </div>
            </div>
          </div>

          <div id="navbar-container" className="container">
            <div className="navbar-header">
              <button
                type="button"
                className="navbar-toggle"
                data-toggle="collapse"
                data-target="#navbar-menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  x="0px"
                  y="0px"
                  width="30"
                  height="10"
                  viewBox="0 0 50 50"
                >
                  <path d="M 5 8 A 2.0002 2.0002 0 1 0 5 12 L 45 12 A 2.0002 2.0002 0 1 0 45 8 L 5 8 z M 5 23 A 2.0002 2.0002 0 1 0 5 27 L 45 27 A 2.0002 2.0002 0 1 0 45 23 L 5 23 z M 5 38 A 2.0002 2.0002 0 1 0 5 42 L 45 42 A 2.0002 2.0002 0 1 0 45 38 L 5 38 z"></path>
                </svg>
              </button>
              <a className="navbar-brand" href="">
                <img className="logo" src="images/logo.jpeg" alt="" />
              </a>
            </div>
            <div className="collapse navbar-collapse" id="navbar-menu">
              <ul className="nav navbar-nav menu">
                <li>
                  <a href="">Home</a>
                </li>
                <li>
                  <a href="#about">About Us</a>
                </li>
                <li>
                  <a href="#services">Services</a>
                </li>
                <li>
                  <a href="#contact_form">Contact Us</a>
                </li>
              </ul>
            </div>
          </div>
        </nav>
      </header>

      <section id="home" className="home">
        <div id="carousel" className="carousel slide" data-ride="carousel">
          <div className="carousel-inner" role="listbox">
            <div className="item active">
              <img id="weldingimg" src="images/caro1.jpeg" alt="Construction" />
              <div className="overlay">
                <div
                  className="carousel-caption"
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    flexDirection: "column",
                  }}
                >
                  <h3>We are Certified Engineers</h3>
                  <h1>Welding Equipment Services</h1>
                  <h1 className="second_heading">Creative & Professional</h1>
                  <p>
                    Your Trusted Partner in Welding Equipment Servicing and
                    Maintenance
                  </p>
                </div>
              </div>
            </div>
            <div className="item">
              <img src="images/caro2.jpeg" alt="Construction" />
              <div className="overlay">
                <div
                  className="carousel-caption"
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    flexDirection: "column",
                  }}
                >
                  <h1>Spark your success with top-quality </h1>
                  <h1 className="second_heading">
                    welding equipment sales and service.
                  </h1>
                  <p>
                    Our team has extensive experience in servicing welding
                    equipment for various industries
                  </p>
                </div>
              </div>
            </div>
          </div>

          <a
            className="left carousel-control"
            href="#carousel"
            role="button"
            data-slide="prev"
          >
            <span className="fa fa-angle-left" aria-hidden="true"></span>
            <span className="sr-only">Previous</span>
          </a>
          <a
            className="right carousel-control"
            href="#carousel"
            role="button"
            data-slide="next"
          >
            <span className="fa fa-angle-right" aria-hidden="true"></span>
            <span className="sr-only">Next</span>
          </a>
        </div>
      </section>

      <section id="about">
        <div className="container about_bg">
          <div className="row">
            <div className="col-lg-7 col-md-6 about_content_bg">
              <div className="about_content">
                <h2>Welcome to Our Company</h2>
                <h3>Quality Services . Exceptional Results.</h3>
                <p>
                  At Shree Sadguru Engineers, we are a team of experienced
                  professionals who specialize in the repair, maintenance, and
                  upgrading of welding equipment, particularly in the heavy
                  fabrication units and various industries. Our expertise lies
                  in understanding the diverse needs of our clients and
                  providing customized solutions that meet their unique
                  requirements
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="why_us">
        <div className="container text-center">
          <div className="row">
            <div className="col-md-8 col-md-offset-2">
              <div className="head_title">
                <h2>WHY CHOOSE US?</h2>
                <p>
                  Here are some reasons why our clients choose us for their
                  welding equipment repair and maintenance needs:
                </p>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-md-3 col-sm-6">
              <div className="why_us_item">
                <span className="fa fa-leaf"></span>
                <h4>Expertise</h4>
                <p>
                  Our team has extensive experience in welding equipment repair
                  and maintenance.
                </p>
              </div>
            </div>
            <div className="col-md-3 col-sm-6">
              <div className="why_us_item">
                <span className="fa fa-futbol-o"></span>
                <h4>Customized Solutions</h4>
                <p>
                  We provide customized solutions that meet the specific needs
                  of our clients.
                </p>
              </div>
            </div>
            <div className="col-md-3 col-sm-6">
              <div className="why_us_item">
                <span className="fa fa-group"></span>
                <h4>Reliability</h4>
                <p>
                  We are committed to delivering reliable and efficient service,
                  ensuring minimal downtime and maximum productivity
                </p>
              </div>
            </div>
            <div className="col-md-3 col-sm-6">
              <div className="why_us_item">
                <span className="fa fa-line-chart"></span>
                <h4>Cost-Effective</h4>
                <p>
                  Our services are designed to be cost-effective, ensuring that
                  our clients can achieve their goals without breaking the bank.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="products">
        <div className="container">
          <h2 style={{ textAlign: "center", marginTop: 10 }}>OUR PRODUCTS</h2>
          <div className="logo-scroll-container">
            <Marquee
              velocity={20} // Adjust the speed
              resetAfterTries={200} // Number of attempts before resetting
              scatterRandomly={false} // Keep logos in line
              direction="ltr" // Scroll from left to right (optional)
            >
              {products.concat(products).map(
                (
                  product,
                  index // Repeat logos for seamless effect
                ) => (
                  <div key={index} className="product-item">
                    <img src={product?.url} alt={product?.alt} />
                  </div>
                )
              )}
            </Marquee>
          </div>
        </div>
      </section>

      <section id="services">
        <div className="container">
          <h2>OUR SERVICES</h2>
          <div className="row">
            <div className="service_ind_item col-md-4">
              <div className="service_item">
                <img
                  src="images/welding_equipment_service.jpg"
                  alt="Our Services"
                />
                <h3>WELDING EQUIPMENT SERVICING</h3>
                <p>
                  We provide regular servicing of welding equipment, including
                  troubleshooting and fault rectification, to ensure that our
                  client's equipment is running smoothly and efficiently.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="service_item">
                <img src="images/annual_contract.jpg" alt="Our Services" />
                <h3>ANNUAL MAINTENANCE CONTRACTS</h3>
                <p>
                  We offer annual maintenance contracts for welding equipment,
                  which includes regular servicing, maintenance, and repair to
                  ensure that our client's equipment is always in good working
                  condition.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="service_item">
                <img src="images/heavy_fabrication.jpg" alt="Our Services" />
                <h3>SPECIALIZED SERVICES FOR HEAVY FABRICATION UNITS</h3>
                <p>
                  Our team has extensive experience in servicing welding
                  equipment for heavy fabrication units, including those used in
                  cement industries, automobile manufacturers, shipbuilding
                  industries, pre-engineered buildings, railway bridges
                  construction companies, and more.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="our_clients">
        <h2>Our Clients</h2>
        <div className="logo-scroll-container">
          <Marquee
            velocity={20} // Adjust the speed
            resetAfterTries={200} // Number of attempts before resetting
            scatterRandomly={false} // Keep logos in line
            direction="ltr" // Scroll from left to right (optional)
          >
            {logos.concat(logos).map(
              (
                logo,
                index // Repeat logos for seamless effect
              ) => (
                <div key={index} className="logo-item">
                  <img src={logo?.url} alt={logo?.alt} />
                </div>
              )
            )}
          </Marquee>
        </div>
      </section>

      {/* <section id="testimonial">
        <div className="container text-center testimonial_area">
          <h2>Customer Reviews</h2>
          <p>
            Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut
            fugit, sed quia consequuntur magni dolores eos qui ratione
            voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem
            ipsum quia dolor sit amet, consectetur, adipisci velit,
          </p>

          <div className="row">
            <div className="col-md-4">
              <div className="testimonial_item">
                <div className="testimonial_content text-left">
                  <p>
                    Guys one small request to everyone who’s playing
                    tomorrow…repu andaram full effort petti adadam….we should
                    play to win inka
                  </p>
                </div>
                <img src="images/varun.png" alt="Testimonial" />
                <p className="worker_name">Mokire Varun Boy</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="testimonial_item">
                <div className="testimonial_content">
                  <p>Tagubothu lanza</p>
                </div>
                <img src="images/laxmi.jpeg" alt="Testimonial" />
                <p className="worker_name">Attaka LaxmiPathi</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="testimonial_item">
                <div className="testimonial_content">
                  <p>How to give 17 runs in 1 ball</p>
                </div>
                <img src="images/varun1.jpeg" alt="Testimonial" />
                <p className="worker_name">Ashok Dinda</p>
              </div>
            </div>
          </div>
        </div>
      </section> */}
      <section id="contact_form">
        <div className="container">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            className="row"
          >
            <div style={{ textAlign: "center" }} className="col-md-6">
              <h2>Do you have any questions?</h2>
              <h2 className="second_heading">Feel free to contact us!</h2>
            </div>
            <form
              onSubmit={handleSendEmail}
              className="form-inline text-right col-md-6"
            >
              <div className="form-group">
                <input
                  type="text"
                  className="form-control"
                  id="name"
                  name="name"
                  placeholder="Name/Company Name"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <input
                  type="email"
                  className="form-control"
                  id="email"
                  placeholder="Email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <input
                  type="text"
                  className="form-control"
                  id="phoneNo"
                  placeholder="Phone number"
                  name="phoneNo"
                  value={formData.phoneNo}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <textarea
                  className="form-control"
                  rows="5"
                  id="msg"
                  placeholder="Message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                ></textarea>
              </div>
              <button type="submit" className="btn submit_btn">
                Submit
              </button>
            </form>
            {mailStatus && (
              <span
                style={{ fontSize: "20px", color: "green", paddingTop: "20px" }}
              >
                Details submitted successfully
              </span>
            )}
            {error && (
              <span
                style={{ fontSize: "20px", color: "red", paddingTop: "20px" }}
              >
                Please enter all fields
              </span>
            )}
          </div>
        </div>
      </section>
      <footer>
        <div className="container footer_top">
          <div className="row">
            <div className="col-lg-6 col-sm-7">
              <div className="footer_item">
                <h4>About Company</h4>
                <img
                  className="logo"
                  src="images/logo.jpeg"
                  alt="Construction"
                />
                <p>
                  We are committed to delivering exceptional service and
                  ensuring the satisfaction of our clients. We strive to build
                  long-term relationships with our clients by providing
                  personalized attention, expert knowledge, and a commitment to
                  excellence.
                </p>

                <ul className="list-inline footer_social_icon">
                  <li>
                    <a href="">
                      <span className="fa fa-facebook"></span>
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="fa fa-twitter"></span>
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="fa fa-youtube"></span>
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="fa fa-google-plus"></span>
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="fa fa-linkedin"></span>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-lg-2 col-sm-5">
              <div className="footer_item">
                <h4>Explore link</h4>
                <ul className="list-unstyled footer_menu">
                  <li>
                    <a href="">
                      <span className="fa fa-play"></span> Our services
                    </a>{" "}
                  </li>
                  <li>
                    <a href="">
                      <span className="fa fa-play"></span> Meet our team
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="fa fa-play"></span> Forum
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="fa fa-play"></span> Help center
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="fa fa-play"></span> Contact Cekas
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="fa fa-play"></span> Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="fa fa-play"></span> Cekas terms
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="fa fa-play"></span> Site map
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-lg-4 col-sm-5">
              <div className="footer_item">
                <h4>Contact us</h4>
                <ul className="list-unstyled footer_contact">
                  <li>
                    <a href="">
                      <span className="fa fa-map-marker"></span>5-4-33, Shop-23,
                      Sterling Appartments, Ranigunj, Secunderabad City,
                      Secunderabad - 500003 (Near AP Tourism Bus Depo)
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="fa fa-envelope"></span>{" "}
                      sreesadguruengineers@gmail.com
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="fa fa-mobile"></span>
                      <p>
                        08197192589 <br />
                        9246541101
                      </p>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </footer>
      {isVisible && (
        <button
          onClick={scrollToTop}
          className="scroll-to-top"
          title="Go to top"
        ></button>
      )}
    </div>
  );
}

export default App;
