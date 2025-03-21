import React from "react";
import Footer from "../components/Footer";
import Objective from "../components/Objective";
import Services from "../components/Services";
import Carousel from "../components/Carousel";
import Donation from "../components/Donation";
import ContactUsForm from "../components/ContactUs";
import CoreMembers from "../components/coremembersmain";
import About from "./About";




const Home = () => {
  return (
    <>
      {/* <Navbar /> */}
      {/* Add other sections here */}
      <Carousel />
      <About />
      {/* <Services /> */}
      {/* <Objective /> */}
      <CoreMembers />
      <ContactUsForm />
    </>
  );
};

export default Home;