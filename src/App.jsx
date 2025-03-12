import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import About from "./pages/About";
import { initializeScripts } from "./utils/init";
import Services from "./components/Services";
import Objective from "./components/Objective";
import Donate from "./pages/donate";


function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/objective" element={<Objective />} />
          <Route path="/donate" element={<Donate />} />

          {/* 
        <Route path="/projects" element={<Projects />} />
        <Route path="/team" element={<Team />} />
        
        <Route path="/contact" element={<Contact />} />
        <Route path="/quote" element={<Quote />} /> */}
        </Routes>
      </Router>
    </>
  );
}

export default App;
