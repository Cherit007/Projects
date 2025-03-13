import React from "react";
import "../index.css"; // Import CSS for the loader

const Loader = () => {
  return (
    <div className="loader-overlay">
      <div className="loader-spinner"></div>
    </div>
  );
};

export default Loader;