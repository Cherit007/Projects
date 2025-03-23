import React, { useState, useEffect } from "react";
import person1 from "/img/person1.jpg";
import person2 from "/img/person2.jpg";
import person3 from "/img/founder.jpeg";
import banner1 from "/img/banner1.jpeg";
import banner2 from "/img/banner2.jpeg";
import banner3 from "/img/banner31.jpg";
import banner4 from "/img/founder.jpeg";
import "../index.css"; // Ensure styles are applied correctly

const Carousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1000); // Check screen width

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1000);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
        "श्री सज्जन सिंह वर्मा एक प्रतिष्ठित नेता हैं, जिनकी पूर्व कैबिनेट मंत्री और मध्य प्रदेश से पूर्व सांसद के रूप में विरासत ने देश के राजनीतिक परिदृश्य पर अमिट छाप छोड़ी है।",
      event: "समुदाय की एकता और विकास के लिए हमारे प्रयास",
      venue: "नई दिल्ली, भारत",
    },
    {
      // Third slide with image on the right and text on the left
      image: banner3,
      title: "शिक्षा और प्रगति",
      description:
        "दूरदर्शी नेता के रूप में श्री सज्जन सिंह वर्मा खटीक समाज के सदस्यों के लिए समान अवसरों का निर्माण करने हेतु सक्रिय रूप से कार्य कर रहे हैं, जिससे वे जीवन के प्रत्येक क्षेत्र में प्रगति कर सकें और सफल हो सकें।",
      event: "शिक्षा और प्रगति के लिए हमारे कार्यक्रम",
      venue: "मुंबई, भारत",
    },
    {
      // Fourth slide with image on the right and text on the left
      image: banner4,
      title: "",
      description: `एक सितारा......... जो कही गुम हो गया
    संक्षिप्त जीवन परिचय-क्रिया कलाप एवं संसदीय सेवायें
    हम मंजिल की ओर चल रहे है... मेरे साथ हजारों साथियों का काफिला है।
    काफिले के कुछ साथी बीच रास्ते में ही साथ छोड़ देते हैं... कुछ नये
    आकर मेरे काफिले में शामिल हो जाते हैं। छोड़कर जाने वालों से
    कोई गिला नहीं... नये आने वाले से कोई उत्साह नहीं...
    आने वाले आते रहेंगे, जाने वाले जाते रहेंगे। बस हमे
    चलना है... सच्चाई, दृढ़ता और लगनशीलता के
    साथ मंजिल पर पहुँचना है। हमारी मंजिल है,
    जाति धर्म से अलग-शोषितों, कमजोरों,
    पिछड़ों और दलितों के अधिकार
    और सम्मान की प्राप्ति... ।
    राजनाथ सोनकर शास्त्री`,
      event: "",
      venue: "",
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length]);

  useEffect(() => {
    console.log("Current Slide Description:", slides[currentSlide].description);
  }, [currentSlide]);

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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "500px",
        width: "100vw",
        marginBottom: "10px",
        overflow: "hidden",
      }}
    >
      <div
        className="carousel-content"
        style={{
          backgroundColor: "white",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          marginTop: "0px",
          borderRadius: "15px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.1)",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Navigation Arrows */}
        <button
          className="carousel-prev"
          onClick={prevSlide}
          style={{
            position: "absolute",
            left: "-5px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            fontSize: "40px",
            color: "#d32f2f",
            cursor: "pointer",
            zIndex: 10,
          }}
        >
          &#10094;
        </button>
        <button
          className="carousel-next"
          onClick={nextSlide}
          style={{
            position: "absolute",
            right: "-5px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            fontSize: "40px",
            color: "#d32f2f",
            cursor: "pointer",
            zIndex: 10,
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
                zIndex: 2,
              }}
            >
              {slides[currentSlide].personImages.map((img, index) => (
                <div
                  key={index}
                  style={{
                    marginTop: "10px",
                    width: "100%",
                    height: isMobile ? "200px" : "300px",
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
                padding: isMobile ? "0px" : "20px",
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
                  whiteSpace: "pre-wrap", // Preserve both line breaks and indentation
                }}
              >
                {slides[currentSlide].description}
              </p>
              <h2
                style={{
                  fontSize: isMobile ? "16px" : "20px",
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
                  overflow: "hidden",
                  height: "100%",
                  display: "flex",
                  justifyContent: "center",
                  flexDirection: "column",
                  fontFamily: "'Poppins', sans-serif",
                  color: "#333",
                  padding: isMobile ? "0px" : "20px",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
                  animation: "fadeIn 1s ease-in-out",
                  margin: "0 auto",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  background: "linear-gradient(to bottom, #fff8e1, #ffffff)",
                }}
              >
                <h1
                  style={{
                    color: "#d32f2f",
                    fontSize: "clamp(28px, 5vw, 36px)",
                    fontWeight: "bold",
                    letterSpacing: "1px",
                    marginBottom: "10px",
                    animation: "slideInLeft 1s ease-in-out",
                    textShadow: "2px 2px 4px rgba(0, 0, 0, 0.1)",
                  }}
                >
                  {slides[currentSlide].title}
                </h1>
                <p
                  style={{
                    fontSize: "clamp(16px, 3vw, 18px)",
                    fontWeight: "500",
                    color: "#555",
                    marginBottom: "15px",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap",
                    textIndent: "210px", // Preserve both line breaks and indentation
                  }}
                >
                  {slides[currentSlide].description}
                </p>
                <h2
                  style={{
                    fontSize: "clamp(18px, 4vw, 20px)",
                    fontWeight: "bold",
                    color: "#222",
                    marginBottom: "15px",
                    animation: "slideInRight 1s ease-in-out",
                    textShadow: "1px 1px 2px rgba(0, 0, 0, 0.1)",
                  }}
                >
                  {slides[currentSlide].event}
                </h2>
                <p
                  style={{
                    fontSize: "clamp(16px, 3vw, 20px)",
                    fontWeight: "600",
                    color: "#444",
                    animation: "fadeIn 2s ease-in-out",
                    marginBottom: "0",
                  }}
                >
                  {slides[currentSlide].venue}
                </p>
              </div>
            )}

            {/* Image on the Right */}
            <div
              style={{
                width: slides[currentSlide].isTopContent ? "100%" : "40%",
                height: "100%",
                overflow: "hidden",
              }}
            >
              <img
                src={slides[currentSlide].image}
                alt="Slide Image"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
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