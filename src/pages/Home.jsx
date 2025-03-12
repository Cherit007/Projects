import React from "react";
import Navbar from "../components/Navbar";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Objective from "../components/Objective";
import Services from "../components/Services";
import Carousel from "../components/Carousel";
import Donation from "../components/Donation";


const Home = () => {
  return (
    <>
      <Navbar />
      {/* Add other sections here */}
      <Carousel />
      <Services />

      <Objective />
      <Footer />
    </>
  );
};

export default Home;