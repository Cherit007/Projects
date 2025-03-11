import React from "react";
import Navbar from "../components/Navbar";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Testimonials from "../components/Testimonials";
import Services from "../components/Services";
import Carousel from "../components/Carousel";

const Home = () => {
  return (
    <>
      <Navbar />
      {/* Add other sections here */}
      <Carousel />
      <Services />

      <Testimonials />
      <Footer />
    </>
  );
};

export default Home;