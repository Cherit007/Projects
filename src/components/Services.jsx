import React from "react";
import "../index.css"; // Add CSS for styling

const Services = () => {
  const services = [
    {
      image: "https://t4.ftcdn.net/jpg/04/42/21/29/360_F_442212933_x52WP2tG23txpK2x7PvydD1xxPlWta1F.jpg",
      title: "Our community",
      description: "Stet stet justo dolor sed duo. Ut clita sea sit ipsum diam lorem diam.",
    },
    {
      image: "https://media.istockphoto.com/id/857146092/photo/sea-of-hands.jpg?s=612x612&w=0&k=20&c=mpZdzYstDIE_OGQ9PivyYdtA5Vq8wwbZF_uazfbfuwo=",
      title: "Community",
      description: "Stet stet justo dolor sed duo. Ut clita sea sit ipsum diam lorem diam.",
    },
    {
      image: "https://images.twinkl.co.uk/tr/image/upload/t_illustration/illustation/community-cohesion.png",
      title: "Community",
      description: "Stet stet justo dolor sed duo. Ut clita sea sit ipsum diam lorem diam.",
    }
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