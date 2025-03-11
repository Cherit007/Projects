import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import About from "./pages/About";
import { initializeScripts } from "./utils/init";
import Services from "./components/Services";
import Testimonials from "./components/Testimonials";
import Events from "./pages/Events"; 
import EventDetails from "./pages/EventDetails"; // Import EventDetails page



function App() {
  return (
    <>
      {/* <Router> */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/events" element={<Events />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/testimonials" element={<Testimonials />} />
          <Route path="/events/:eventId" element={<EventDetails />} /> 

          {/* 
        <Route path="/projects" element={<Projects />} />
        <Route path="/team" element={<Team />} />
        
        <Route path="/contact" element={<Contact />} />
        <Route path="/quote" element={<Quote />} /> */}
        </Routes>
      {/* </Router> */}
    </>
  );
}

export default App;
