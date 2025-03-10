import React from "react";
import "../index.css"; // Add CSS for styling

const Services = () => {
  const services = [
    {
      image: "img/service-1.jpg",
      title: "General Carpentry",
      description: "Stet stet justo dolor sed duo. Ut clita sea sit ipsum diam lorem diam.",
    },
    {
      image: "img/service-2.jpg",
      title: "Furniture Manufacturing",
      description: "Stet stet justo dolor sed duo. Ut clita sea sit ipsum diam lorem diam.",
    },
    {
      image: "img/service-3.jpg",
      title: "Furniture Remodeling",
      description: "Stet stet justo dolor sed duo. Ut clita sea sit ipsum diam lorem diam.",
    },
    {
      image: "img/service-4.jpg",
      title: "Wooden Floor",
      description: "Stet stet justo dolor sed duo. Ut clita sea sit ipsum diam lorem diam.",
    },
    {
      image: "img/service-5.jpg",
      title: "Wooden Furniture",
      description: "Stet stet justo dolor sed duo. Ut clita sea sit ipsum diam lorem diam.",
    },
    {
      image: "img/service-6.jpg",
      title: "Custom Work",
      description: "Stet stet justo dolor sed duo. Ut clita sea sit ipsum diam lorem diam.",
    },
  ];

  return (
    <div className="services-container">
      <div className="section-title text-center">
        <h1 className="display-5 mb-5">Our Services</h1>
      </div>
      <div className="services-grid">
        {services.map((service, index) => (
          <div key={index} className="service-item wow fadeInUp" data-wow-delay={`0.${index + 1}s`}>
            <div className="overflow-hidden">
              <img className="img-fluid" src={service.image} alt={service.title} />
            </div>
            <div className="service-content">
              <h4 className="mb-3">{service.title}</h4>
              <p>{service.description}</p>
              <a className="fw-medium" href="/">
                Read More<i className="fa fa-arrow-right ms-2"></i>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Services;