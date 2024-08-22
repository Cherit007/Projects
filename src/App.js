// import "./custom.css";
import { useEffect, useState } from "react";

function App() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
    phoneNo:"",
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

  const handleSendEmail = async (e) => {
    e.preventDefault();
    try {
      if (!formData.name || !formData.email || !formData.phoneNo) {
        setError(true);
        return;
      }
      setError(false);
      const response = await fetch("/submit-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        setMailStatus(true);
        console.log("Form successfully submitted:", result);
        setFormData({
          name: "",
          email: "",
          message: "",
          phoneNo:""
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
      {/* <div id="loading">
        <div id="loading-center">
          <div id="loading-center-absolute">
            <div className="object"></div>
            <div className="object"></div>
            <div className="object"></div>
            <div className="object"></div>
            <div className="object"></div>
            <div className="object"></div>
            <div className="object"></div>
            <div className="object"></div>
            <div className="object"></div>
            <div className="object"></div>
          </div>
        </div>
      </div> */}
      <header>
        <div className="top_nav">
          <div className="container">
            <ul className="list-inline info">
              <li>
                <a href="#">
                  <span className="fa fa-phone"></span> +91 9246541101
                </a>
              </li>
              <li>
                <a href="#">
                  <span className="fa fa-envelope"></span> support@Construct.com
                </a>
              </li>
              <li>
                <a href="#">
                  <span className="fa fa-clock-o"></span> Mon - Sat 9:00 - 19:00
                </a>
              </li>
            </ul>
            <ul className="list-inline social_icon">
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
                  <span className="fa fa-behance"></span>
                </a>
              </li>
              <li>
                <a href="">
                  <span className="fa fa-dribbble"></span>
                </a>
              </li>
              <li>
                <a href="">
                  <span className="fa fa-linkedin"></span>
                </a>
              </li>
              <li>
                <a href="">
                  <span className="fa fa-youtube"></span>
                </a>
              </li>
            </ul>
          </div>
        </div>

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
                  <a href="#portfolio">Portfolio</a>
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
              <img
                id="weldingimg"
                src="images/slider_img.jpg"
                alt="Construction"
              />
              <div className="overlay">
                <div className="carousel-caption">
                  <h3>We are Certified Engineers</h3>
                  <h1>Construction Services</h1>
                  <h1 className="second_heading">Creative & Professional</h1>
                  <p>
                    Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut
                    odit aut fugit, sed quia consequuntur magni dolores eos qui
                    ratione voluptatem sequi nesciunt. Neque porro quisquam est,
                    qui dolorem ipsum quia dolor sit amet, consectetur, adipisci
                    velit,
                  </p>
                  <a className="btn know_btn">know more</a>
                  <a className="btn know_btn">view project</a>
                </div>
              </div>
            </div>
            <div className="item">
              <img src="images/slider_img2.jpg" alt="Construction" />
              <div className="overlay">
                <div className="carousel-caption">
                  <h3>We are Certified Engineers</h3>
                  <h1>Construction Services</h1>
                  <h1 className="second_heading">Creative & Professional</h1>
                  <p>
                    Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut
                    odit aut fugit, sed quia consequuntur magni dolores eos qui
                    ratione voluptatem sequi nesciunt. Neque porro quisquam est,
                    qui dolorem ipsum quia dolor sit amet, consectetur, adipisci
                    velit,
                  </p>
                  <a className="btn know_btn">know more</a>
                  <a className="btn know_btn">view project</a>
                </div>
              </div>
            </div>
            <div className="item">
              <img src="images/slider_img3.jpg" alt="Construction" />
              <div className="overlay">
                <div className="carousel-caption">
                  <h3>We are Certified Engineers</h3>
                  <h1>Construction Services</h1>
                  <h1 className="second_heading">Creative & Professional</h1>
                  <p>
                    Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut
                    odit aut fugit, sed quia consequuntur magni dolores eos qui
                    ratione voluptatem sequi nesciunt. Neque porro quisquam est,
                    qui dolorem ipsum quia dolor sit amet, consectetur, adipisci
                    velit,
                  </p>
                  <a className="btn know_btn">know more</a>
                  <a className="btn know_btn">view project</a>
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
            <div className="col-lg-7 col-md-6">
              <div className="about_content">
                <h2>Welcome to Our Company</h2>
                <h3>Aliquam lacus purus, auctor malesuada</h3>
                <p>
                  Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut
                  odit aut fugit, sed quia consequuntur magni dolores eos qui
                  ratione voluptatem sequi nesciunt. Neque porro quisquam est,
                  qui dolorem ipsum quia dolor sit amet, consectetur, adipisci
                  velit,
                </p>
                <p>
                  sed quia non numquam eius modi tempora incidunt ut labore et
                  dolore magnam aliquam quaerat voluptatem. Ut enim ad minima
                  veniam, quis nostrum exercitationem ullam corporis suscipit
                  laboriosam, nisi ut aliquid ex ea commodi consequatur?{" "}
                </p>
                <a className="btn know_btn">know more</a>
              </div>
            </div>
            <div className="col-lg-3 col-md-6 col-lg-offset-1">
              <div className="about_banner">
                <img src="images/laxmi1.jpeg" alt="" />
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
                  Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut
                  odit aut fugit, sed quia consequuntur magni dolores eos qui
                  ratione voluptatem sequi nesciunt. Neque porro quisquam est,
                  qui dolorem ipsum quia dolor sit amet, consectetur, adipisci
                  velit,
                </p>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-md-3 col-sm-6">
              <div className="why_us_item">
                <span className="fa fa-leaf"></span>
                <h4>We deliver quality</h4>
                <p>
                  Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut
                  odit aut fugit, sed quia consequuntur magni{" "}
                </p>
              </div>
            </div>
            <div className="col-md-3 col-sm-6">
              <div className="why_us_item">
                <span className="fa fa-futbol-o"></span>
                <h4>Always on time</h4>
                <p>
                  Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut
                  odit aut fugit, sed quia consequuntur magni
                </p>
              </div>
            </div>
            <div className="col-md-3 col-sm-6">
              <div className="why_us_item">
                <span className="fa fa-group"></span>
                <h4>We are pasionate</h4>
                <p>
                  Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut
                  odit aut fugit, sed quia consequuntur magni
                </p>
              </div>
            </div>
            <div className="col-md-3 col-sm-6">
              <div className="why_us_item">
                <span className="fa fa-line-chart"></span>
                <h4>Professional Services</h4>
                <p>
                  Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut
                  odit aut fugit, sed quia consequuntur magni
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services">
        <div className="container">
          <h2>OUR SERVICES</h2>
          <div className="row">
            <div className="col-md-4">
              <div className="service_item">
                <img src="images/service_img1.jpg" alt="Our Services" />
                <h3>CONSTRUCTION MANAGEMENT</h3>
                <p>
                  Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut
                  odit aut fugit, sed quia consequuntur magni dolores eos qui
                  ratione voluptatem sequi nesciunt. Neque porro quisquam est,
                  qui dolorem ipsum quia dolor sit amet, consectetur, adipisci
                  velit,
                </p>
                <a href="#services" className="btn know_btn">
                  know more
                </a>
              </div>
            </div>
            <div className="col-md-4">
              <div className="service_item">
                <img src="images/service_img2.jpg" alt="Our Services" />
                <h3>RENOVATION</h3>
                <p>
                  Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut
                  odit aut fugit, sed quia consequuntur magni dolores eos qui
                  ratione voluptatem sequi nesciunt. Neque porro quisquam est,
                  qui dolorem ipsum quia dolor sit amet, consectetur, adipisci
                  velit,
                </p>
                <a href="#services" className="btn know_btn">
                  know more
                </a>
              </div>
            </div>
            <div className="col-md-4">
              <div className="service_item">
                <img src="images/service_img3.jpg" alt="Our Services" />
                <h3>ARCHITECTURE</h3>
                <p>
                  Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut
                  odit aut fugit, sed quia consequuntur magni dolores eos qui
                  ratione voluptatem sequi nesciunt. Neque porro quisquam est,
                  qui dolorem ipsum quia dolor sit amet, consectetur, adipisci
                  velit,
                </p>
                <a href="#services" className="btn know_btn">
                  know more
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="testimonial">
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
                  Guys one small request to everyone who’s playing tomorrow…repu andaram full effort petti adadam….we should play to win inka
                  </p>
                </div>
                <img src="images/varun.png" alt="Testimonial" />
                <p className="worker_name">Mokire Varun Boy</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="testimonial_item">
                <div className="testimonial_content">
                  <p>
                    Tagubothu lanza
                  </p>
                </div>
                <img src="images/laxmi.jpeg" alt="Testimonial" />
                <p className="worker_name">Attaka LaxmiPathi</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="testimonial_item">
                <div className="testimonial_content">
                  <p>
                    How to give 17 runs in 1 ball
                  </p>
                </div>
                <img src="images/varun1.jpeg" alt="Testimonial" />
                <p className="worker_name">Ashok Dinda</p>
              </div>
            </div>
          </div>
        </div>
      </section>
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
                  placeholder="Name"
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
                Mail Sent successfully
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
            <div className="col-lg-4 col-sm-7">
              <div className="footer_item">
                <h4>About Company</h4>
                <img
                  className="logo"
                  src="images/logo.png"
                  alt="Construction"
                />
                <p>
                  Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut
                  odit aut fugit, sed quia consequuntur magni dolores eos qui
                  ratione voluptatem sequi nesciunt. Neque porro quisquam est,
                  qui dolorem
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
            <div className="col-lg-3 col-sm-7">
              <div className="footer_item">
                <h4>Latest post</h4>
                <ul className="list-unstyled post">
                  <li>
                    <a href="">
                      <span className="date">
                        20 <small>AUG</small>
                      </span>{" "}
                      Luptatum omittantur duo ne mpetus indoctum
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="date">
                        20 <small>AUG</small>
                      </span>{" "}
                      Luptatum omittantur duo ne mpetus indoctum
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="date">
                        20 <small>AUG</small>
                      </span>{" "}
                      Luptatum omittantur duo ne mpetus indoctum
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="date">
                        20 <small>AUG</small>
                      </span>{" "}
                      Luptatum omittantur duo ne mpetus indoctum
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-lg-3 col-sm-5">
              <div className="footer_item">
                <h4>Contact us</h4>
                <ul className="list-unstyled footer_contact">
                  <li>
                    <a href="">
                      <span className="fa fa-map-marker"></span> 124 New Line,
                      London UK
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="fa fa-envelope"></span>{" "}
                      hello@psdfreebies.com
                    </a>
                  </li>
                  <li>
                    <a href="">
                      <span className="fa fa-mobile"></span>
                      <p>
                        +44 00 00 1234 <br />
                        +44 00 00 1234
                      </p>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="footer_bottom text-center">
          <p className="wow fadeInRight">
            Made with
            <i className="fa fa-heart"></i>
            by
            <a target="_blank" href="http://bootstrapthemes.co">
              Bootstrap Themes
            </a>
            2016. All Rights Reserved
          </p>
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
