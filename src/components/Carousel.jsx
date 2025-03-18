// import React, { useState, useEffect } from "react";
// import "../index.css"; // Add CSS for styling

// const Carousel = () => {
//   const [currentSlide, setCurrentSlide] = useState(0);

//   const slides = [
//     {
//       image: "img/cover.avif",
//       title: "Welcome to Our Community",
//       description: "Vero elitr justo clita lorem. Ipsum dolor at sed stet sit diam no. Kasd rebum ipsum et diam justo clita et kasd rebum sea elitr.",
//     },
   
//   ];

//   const nextSlide = () => {
//     setCurrentSlide((prev) => (prev + 1) % slides.length);
//   };

//   const prevSlide = () => {
//     setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
//   };

//   useEffect(() => {
//     const interval = setInterval(() => {
//       nextSlide();
//     }, 5000); // Auto-play every 5 seconds

//     return () => clearInterval(interval);
//   }, [currentSlide]);

//   return (
//     <div className="carousel">
//       {slides.map((slide, index) => (
//         <div
//           key={index}
//           className={`carousel-slide ${index === currentSlide ? "active" : ""}`}
//           style={{ backgroundImage: `url(${slide.image})` }}
//         >
//           <div className="carousel-overlay">
//             <div className="carousel-content">
//               {/* <h5 className="text-white">WELCOME TO WOODY</h5> */}
//               <h1 className="text-white">{slide.title}</h1>
//               <p className="text-white">{slide.description}</p>
//             </div>
//           </div>
//         </div>
//       ))}

// {/* <div className="carousel-navigation">
//         <button className="carousel-prev" onClick={prevSlide}>
//         &#10095;
//         </button>
//         <button className="carousel-next" onClick={nextSlide}>
//         &#10094;
//         </button>
//       </div> */}
//     </div>
//   );
// };

// export default Carousel;

import React from "react";
import person1 from "../assets/person1.jpg";
import person2 from "../assets/person2.jpg";
import "../index.css"; // Ensure styles are applied correctly

const Carousel = () => {
  return (
    <div className="carousel" style={{ 
      backgroundColor: "#e3e3e3",  // Slightly darker for contrast
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      height: "100vh", 
      width: "100vw", 
      padding: "20px" 
    }}>
     <div className="carousel-content" style={{ 
  backgroundColor: "white",
  padding: "50px", 
  display: "flex", 
  flexDirection: "column", 
  alignItems: "center", 
  justifyContent: "center", 
  width: "100vw",  // Fully covers the width
  height: "97vh", // Fully covers the height
  marginTop: "0",  
  borderRadius: "15px",  // Remove rounded corners
  boxShadow: "0",  // Remove shadow for a seamless full-width look
  textAlign: "center"
}}>



        {/* Images Section */}
        <div className="image-container" style={{ 
          display: "flex", 
          gap: "40px", 
          marginBottom: "30px" 
        }}>
          <img src={person1} alt="Person 1" style={{ width: "180px", height: "180px", borderRadius: "50%", border: "5px solid #d32f2f" }} />
          <img src={person2} alt="Person 2" style={{ width: "180px", height: "180px", borderRadius: "50%", border: "5px solid #d32f2f" }} />
          <img src={person2} alt="Person 3" style={{ width: "180px", height: "180px", borderRadius: "50%", border: "5px solid #d32f2f" }} />
        </div>

        {/* Event Content */}
        <div className="event-details" style={{ 
          maxWidth: "800px", 
          fontFamily: "'Poppins', sans-serif", 
          color: "#333" 
        }}>
          <h1 style={{ 
            color: "#d32f2f", 
            fontSize: "36px", 
            fontWeight: "bold", 
            letterSpacing: "1px",
            marginBottom: "10px" 
          }}>
            Akhil Bharatiya Khatik Samaj
          </h1>
          
          <p style={{ 
            fontSize: "18px", 
            fontWeight: "500", 
            color: "#555", 
            marginBottom: "15px" 
          }}>
            Registered N-441 | Established - 1982
          </p>

          <h2 style={{ 
            fontSize: "28px", 
            fontWeight: "bold", 
            color: "#222", 
            marginBottom: "15px" 
          }}>
            47th National Executive Committee Annual Meeting
          </h2>


          <p style={{ 
            fontSize: "20px", 
            fontWeight: "600", 
            color: "#444" 
          }}>
            <strong>Venue:</strong> Jain Bhavan, Gol Market, New Delhi
          </p>
        </div>

      </div>
    </div>
  );
};

export default Carousel;


