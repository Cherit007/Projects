import React, { useState, useEffect } from "react";
import person1 from "../assets/person1.jpg";
import person2 from "../assets/person2.jpg";
import person3 from "../assets/person3.jpg";
import banner1 from "/img/banner1.jpeg";
import banner2 from "/img/banner2.jpeg";
import banner3 from "/img/banner3.jpeg";
import banner4 from "/img/banner4.jpeg";
import "../index.css"; // Ensure styles are applied correctly

const Carousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Dynamic JSON data for slides
  const slides = [
    {
      // image: banner1, // Background image for the first slide
      personImages: [person1, person2, person3], // Three circular images
      title: "Akhil Bharatiya Khatik Samaj",
      description: "Registered N-441 | Established - 1982",
      event: "47th National Executive Committee Annual Meeting",
      venue: "Jain Bhavan, Gol Market, New Delhi",
    },
    {
      image: banner1, // Full-width image for the second slide
    },
    {
      image: banner2, // Full-width image for the second slide
    },
    {
      image: banner3, // Full-width image for the third slide
    },
    {
      image: banner4, // Full-width image for the third slide
    },
  ];

  // Auto-scroll functionality
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000); // Auto-play every 5 seconds

    return () => clearInterval(interval);
  }, [currentSlide, slides.length]);

  // Next slide
  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  // Previous slide
  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  return (
    <div
      className="carousel"
      style={{
        backgroundColor: "#e3e3e3",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
        padding: "20px",
        overflow: "hidden", // Prevent overflow
      }}
    >
      <div
        className="carousel-content"
        style={{
          backgroundColor: "white",
          padding: "50px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "97vh",
          marginTop: "0",
          borderRadius: "15px",
          boxShadow: "0",
          textAlign: "center",
          position: "relative", // For absolute positioning of arrows
          overflow: "hidden", // Prevent overflow
        }}
      >
        {/* Navigation Arrows */}
        <button
          className="carousel-prev"
          onClick={prevSlide}
          style={{
            position: "absolute",
            left: "20px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            fontSize: "40px",
            color: "#d32f2f",
            cursor: "pointer",
            zIndex: 10, // Ensure arrows are above the content
          }}
        >
          &#10094;
        </button>
        <button
          className="carousel-next"
          onClick={nextSlide}
          style={{
            position: "absolute",
            right: "20px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            fontSize: "40px",
            color: "#d32f2f",
            cursor: "pointer",
            zIndex: 10, // Ensure arrows are above the content
          }}
        >
          &#10095;
        </button>

        {/* Full-Width Image for All Slides */}
        <div
          className="full-width-image"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundImage: `url(${slides[currentSlide].image})`,
            backgroundSize: "contain", // Ensure the entire image is visible
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat", // Prevent image repetition
            borderRadius: "15px",
            zIndex: 1, // Ensure it's behind the content
          }}
        ></div>

        {/* Conditional Rendering for First Slide */}
        {currentSlide === 0 && (
          <>
            {/* Three Circular Images for First Slide */}
            <div
              className="image-container"
              style={{
                display: "flex",
                gap: "40px",
                marginBottom: "30px",
                zIndex: 2, // Ensure it's above the full-width image
              }}
            >
              {slides[currentSlide].personImages.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`Person ${index + 1}`}
                  style={{
                    width: "180px",
                    height: "180px",
                    borderRadius: "50%",
                    border: "5px solid #d32f2f",
                  }}
                />
              ))}
            </div>

            {/* Event Content for First Slide */}
            <div
              className="event-details"
              style={{
                maxWidth: "800px",
                fontFamily: "'Poppins', sans-serif",
                color: "#333",
                zIndex: 2, // Ensure it's above the full-width image
              }}
            >
              <h1
                style={{
                  color: "#d32f2f",
                  fontSize: "36px",
                  fontWeight: "bold",
                  letterSpacing: "1px",
                  marginBottom: "10px",
                }}
              >
                {slides[currentSlide].title}
              </h1>

              <p
                style={{
                  fontSize: "18px",
                  fontWeight: "500",
                  color: "#555",
                  marginBottom: "15px",
                }}
              >
                {slides[currentSlide].description}
              </p>

              <h2
                style={{
                  fontSize: "28px",
                  fontWeight: "bold",
                  color: "#222",
                  marginBottom: "15px",
                }}
              >
                {slides[currentSlide].event}
              </h2>

              <p
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#444",
                }}
              >
                <strong>Venue:</strong> {slides[currentSlide].venue}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Carousel;