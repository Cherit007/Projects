import React, { useState, useEffect } from "react";
import "../index.css"; // Add CSS for styling

const Carousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      image: "img/cover.avif",
      title: "Best Carpenter & Craftsman Services",
      description: "Vero elitr justo clita lorem. Ipsum dolor at sed stet sit diam no. Kasd rebum ipsum et diam justo clita et kasd rebum sea elitr.",
    },
    {
      image: "img/carousel-2.jpg",
      title: "Welcome To WooDY",
      description: "Vero elitr justo clita lorem. Ipsum dolor at sed stet sit diam no. Kasd rebum ipsum et diam justo clita et kasd rebum sea elitr.",
    },
    {
      image: "img/carousel-3.jpg",
      title: "Quality Carpentry Services",
      description: "Vero elitr justo clita lorem. Ipsum dolor at sed stet sit diam no. Kasd rebum ipsum et diam justo clita et kasd rebum sea elitr.",
    },
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  useEffect(() => {
    const interval = setInterval(() => {
      nextSlide();
    }, 5000); // Auto-play every 5 seconds

    return () => clearInterval(interval);
  }, [currentSlide]);

  return (
    <div className="carousel">
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`carousel-slide ${index === currentSlide ? "active" : ""}`}
          style={{ backgroundImage: `url(${slide.image})` }}
        >
          <div className="carousel-overlay">
            <div className="carousel-content">
              <h5 className="text-white">WELCOME TO WOODY</h5>
              <h1 className="text-white">{slide.title}</h1>
              <p className="text-white">{slide.description}</p>
            </div>
          </div>
        </div>
      ))}

<div className="carousel-navigation">
        <button className="carousel-prev" onClick={prevSlide}>
          &#10094;
        </button>
        <button className="carousel-next" onClick={nextSlide}>
          &#10095;
        </button>
      </div>
    </div>
  );
};

export default Carousel;