import React from "react";
import Footer from "../components/Footer";
import CommunityTable from "../components/Members"; // Ensure this is correctly exported

const About = () => {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px", textAlign: "center" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>About Our Community</h1>
      <p style={{ fontSize: "16px", color: "#555" }}>
        Welcome to our vibrant community! We are a group of like-minded individuals
        who come together to share ideas, collaborate, and support one another.
      </p>

      {/* <div style={{ marginTop: "20px" }}>
        <img
          src="https://source.unsplash.com/800x400/?community,people"
          alt="Community"
          style={{ width: "100%", borderRadius: "10px", boxShadow: "0px 4px 6px rgba(0,0,0,0.1)" }}
        />
      </div> */}

      <h2 style={{ fontSize: "20px", fontWeight: "bold", marginTop: "20px" }}>Our Mission</h2>
      <p style={{ fontSize: "16px", color: "#555" }}>
        Our mission is to foster a supportive and engaging environment where everyone
        feels valued and empowered to contribute.
      </p>


      {/* <Footer /> */}
    </div>
  );
};

export default About;
