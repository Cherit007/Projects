import React from "react";
import {
  MapPin,
  Phone,
} from "lucide-react";
import "../index.css";
import Navbar from "./Navbar";
import logoLeft from "/img/newlogo.png";

const Heading = () => {
  return (
    <div
      style={{
        background: "linear-gradient(to right, #FF6F61, #FFA500)",
        padding: "20px",
        textAlign: "center",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "15px",
          maxWidth: "1200px",
          margin: "0 auto",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", color: "#fff", gap: "4px" }}>
          <MapPin className="icon primary-icon" size={18} />
          <small style={{ fontSize: "16px" }}>मध्य प्रदेश</small>
        </div>
        <img
          src={logoLeft}
          alt="Logo Left"
           className="navbar-logo"
          style={{
            width: "120px",
            height: "auto",
            maxWidth: "100%",
            borderRadius: "65%",
          }}
        />
         {/* <img
                    src={logo}
                    alt="Community Logo"
                    className="navbar-logo"
                    style={{
                      width: "120px", // Adjust size as needed
                      height: "auto",
                      maxWidth: "100%",
                      borderRadius:"65%"
                    }}
                  /> */}
        <div style={{ textAlign: "center", color: "#fff", flex: "1" }}> 
          <h1 style={{ fontSize: "35px", fontWeight: "bold", margin: "0", textShadow: "2px 2px 4px rgba(0, 0, 0, 0.3)" }}>
            अखिल भारतीय खटीक समाज
          </h1>
          <h1 style={{ fontSize: "35px", fontWeight: "bold", margin: "10px 0", textShadow: "2px 2px 4px rgba(0, 0, 0, 0.3)" }}>
            Akhila Bharatiya Khatik Samaj
          </h1>
          <p style={{ fontSize: "18px", margin: "0", textShadow: "1px 1px 2px rgba(0, 0, 0, 0.3)" }}>
            पंजीकृत संख्या - N-441 | स्थापना - 1982
          </p>
        </div>
        <img
          src={logoLeft}
          alt="Logo Left"
           className="navbar-logo"
          style={{
            width: "120px",
            height: "auto",
            maxWidth: "100%",
            borderRadius: "65%",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", color: "#fff", gap: "4px" }}>
          <Phone className="icon primary-icon" size={18} />
          <small style={{ fontSize: "16px" }}>+91 91110 97070</small>
        </div>
      </div>
    </div>
  );
};

export default Heading;
