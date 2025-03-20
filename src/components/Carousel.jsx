import React, { useState, useEffect } from "react";
import person1 from "/img/person1.jpg";
import person2 from "/img/person2.jpg";
import person3 from "/img/person3.jpg";
import banner1 from "/img/banner1.jpeg";
import banner2 from "/img/banner2.jpeg";
import banner3 from "/img/banner31.jpg";
import banner4 from "/img/banner41.jpg";
import "../index.css"; // Ensure styles are applied correctly

const Carousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Dynamic JSON data for slides
  const slides = [
    {
      // First slide with three images and text
      personImages: [person1, person2, person3], // Three images
      title: "अखिल भारतीय खटीक समाज",
      description: "पंजीकृत संख्या - N-441 | स्थापना - 1982",
      event:
        "अखिल भारतीय खटीक समाज (पंजीकृत संख्या - N-441) की स्थापना 1982 में राजनाथ सोनकर शास्त्री और गंगाराम निर्वाण के नेतृत्व में हुई थी। यह संगठन खटीक समुदाय के सामाजिक, शैक्षणिक और आर्थिक उत्थान के लिए समर्पित है, जिससे समाज में एकता और प्रगति को बढ़ावा मिलता है।",
    },
    {
      // Second slide with image on the right and text on the left
      image: banner2,
      title: "समुदाय की एकता",
      description:
        "हमारा उद्देश्य समुदाय को एकजुट करना और उनके अधिकारों के लिए लड़ना है।",
      event: "समुदाय की एकता और विकास के लिए हमारे प्रयास",
      venue: "नई दिल्ली, भारत",
    },
    {
      // Third slide with image on the right and text on the left
      image: banner3,
      title: "शिक्षा और प्रगति",
      description:
        "हम शिक्षा के माध्यम से समुदाय के युवाओं को सशक्त बनाने का प्रयास करते हैं।",
      event: "शिक्षा और प्रगति के लिए हमारे कार्यक्रम",
      venue: "मुंबई, भारत",
    },
    {
      // Fourth slide with image on the right and text on the left
      image: banner4,
      title: "आर्थिक सशक्तिकरण",
      description:
        "हम समुदाय के लोगों को आर्थिक रूप से सशक्त बनाने के लिए कार्यक्रम चलाते हैं।",
      event: "आर्थिक सशक्तिकरण के लिए हमारे प्रयास",
      venue: "बेंगलुरु, भारत",
      isTopContent: true,
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
        // backgroundColor: "#e3e3e3",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
        marginBottom:"10px",
        // padding: "20px",
        overflow: "hidden", // Prevent overflow
      }}
    >
      <div
        className="carousel-content"
        style={{
          backgroundColor: "white",
          // padding: "50px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100vh",
          marginTop: "0px",
          borderRadius: "15px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.1)",
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

        {/* Conditional Rendering for First Slide */}
        {currentSlide === 0 && (
          <>
            {/* Three Images for First Slide */}
            <div
              className="image-container"
              style={{
                width: "100%",
                display: "flex",
                gap: "20px",
                marginBottom: "30px",
                zIndex: 2, // Ensure it's above the full-width image
              }}
            >
              {slides[currentSlide].personImages.map((img, index) => (
                <div
                  key={index}
                  style={{
                    marginTop: "10px",
                    width: "100%",
                    height: "400px",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={img}
                    alt={`Person ${index + 1}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "10%",
                      objectFit: "contain",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Event Content for First Slide */}
            <div
              className="event-details"
              style={{
                fontFamily: "'Poppins', sans-serif",
                color: "#333",
                zIndex: 2,
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                padding: "20px",
                borderRadius: "10px",
                boxShadow: "0 5px 15px rgba(0, 0, 0, 0.1)",
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
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: "#222",
                  marginBottom: "15px",
                }}
              >
                {slides[currentSlide].event}
              </h2>
            </div>
          </>
        )}

        {/* Conditional Rendering for Slides 2, 3, and 4 */}
        {currentSlide > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              height: "100%",
              gap: "10px",
              zIndex: 2,
            }}
          >
            {/* Text Content on the Left */}
            {!slides[currentSlide].isTopContent && (
              <div
                style={{
                  flex: 1,
                  fontFamily: "'Poppins', sans-serif",
                  color: "#333",
                  padding: "20px",
                  backgroundColor: "rgba(255, 255, 255, 0.8)",
                  borderRadius: "10px",
                  // boxShadow: "0 5px 15px rgba(0, 0, 0, 0.1)",
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
                    fontSize: "20px",
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
                  {slides[currentSlide].venue}
                </p>
              </div>
            )}

            {/* Image on the Right */}
            <div
              style={{
                flex: 1,
                height: "100%",
                overflow: "hidden",
                borderRadius: "10%",
              }}
            >
              <img
                src={slides[currentSlide].image}
                alt="Slide Image"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: window.innerWidth < 900 ? "contain" : "cover",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Carousel;
