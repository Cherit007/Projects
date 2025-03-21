import React, { useEffect } from "react";
import {
  MapPin,
  Clock,
  Phone,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
} from "lucide-react";
import "../index.css";
import Navbar from "./Navbar";
import Heading from "./LogosHeading";

const Header = () => {
  return (
    <div>
    

       <div id="google_translate_element" className="translate-widget"></div>
      <Heading />
      <Navbar />
    </div>
  );
};

export default Header;
