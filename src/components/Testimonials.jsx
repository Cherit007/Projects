import React, { useState, useEffect } from "react";
import "../index.css";

const Testimonials = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const testimonials = [
    {
      image: "img/testimonial-1.jpg",
      name: "Client Name 1",
      profession: "Profession 1",
      text: "Clita clita tempor justo dolor ipsum amet kasd amet duo justo duo duo labore sed sed. Magna ut diam sit et amet stet eos sed clita erat magna elitr erat sit sit erat at rebum justo sea clita.",
    },
    {
      image: "img/testimonial-2.jpg",
      name: "Client Name 2",
      profession: "Profession 2",
      text: "Clita clita tempor justo dolor ipsum amet kasd amet duo justo duo duo labore sed sed. Magna ut diam sit et amet stet eos sed clita erat magna elitr erat sit sit erat at rebum justo sea clita.",
    },
    {
      image: "img/testimonial-3.jpg",
      name: "Client Name 3",
      profession: "Profession 3",
      text: "Clita clita tempor justo dolor ipsum amet kasd amet duo justo duo duo labore sed sed. Magna ut diam sit et amet stet eos sed clita erat magna elitr erat sit sit erat at rebum justo sea clita.",
    },
  ];

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  useEffect(() => {
    const interval = setInterval(() => {
      nextTestimonial();
    }, 5000); // Auto-play every 5 seconds

    return () => clearInterval(interval);
  }, [currentTestimonial]);

  return (
    <div className="testimonials-container">
      <div className="section-title text-center">
        <h1 className="display-5 mb-5">Testimonial</h1>
      </div>
      <div className="testimonial-carousel">
        {testimonials.map((testimonial, index) => (
          <div
            key={index}
            className={`testimonial-item ${index === currentTestimonial ? "active" : ""}`}
          >
            <img
              className="testimonial-image"
              src={testimonial.image}
              alt={testimonial.name}
            />
            <div className="testimonial-text">
              <p>{testimonial.text}</p>
              <h5>{testimonial.name}</h5>
              <span className="fst-italic">{testimonial.profession}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Buttons */}
      <button className="carousel-prev" onClick={prevTestimonial}>
        &#10094;
      </button>
      <button className="carousel-next" onClick={nextTestimonial}>
        &#10095;
      </button>
    </div>
  );
};

export default Testimonials;