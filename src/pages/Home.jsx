import React from "react";
import Footer from "../components/Footer";
import Objective from "../components/Objective";
import Services from "../components/Services";
import Carousel from "../components/Carousel";
import Donation from "../components/Donation";


const Home = () => {
  return (
    <>
      {/* <Navbar /> */}
      {/* Add other sections here */}
      <Carousel />
      <Services />
      <Objective />
    </>
  );
};

export default Home;