import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Donation from "../components/Donation";

const Donate = () => {
  return (
    <>
      {/* Navbar */}
      <Navbar />

    <Donation/>

      {/* Footer */}
      <Footer />
    </>
  );
};

export default Donate;