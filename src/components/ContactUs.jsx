import React, { useState } from "react";
import defaultEventImg from '/img/contact.avif'


const ContactUsForm = () => {
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    subject: "",
    message: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form Data Submitted:", formData);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "20px", padding: "20px" }}>
      <img src={defaultEventImg} alt="Contact Us" style={{ width: "200px", height: "auto" }} />
      <form onSubmit={handleSubmit} style={{ maxWidth: "500px", padding: "20px", border: "1px solid #ccc", borderRadius: "5px" }}>
        <h2 style={{ textAlign: "center", marginBottom: "15px" }}>If you have any questions, please contact us</h2>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <input
            type="text"
            name="name"
            placeholder="Your Name"
            value={formData.name}
            onChange={handleChange}
            style={{ flex: 1, padding: "10px", border: "1px solid #ccc", borderRadius: "5px" }}
            required
          />
          <input
            type="tel"
            name="mobile"
            placeholder="Your Mobile"
            value={formData.mobile}
            onChange={handleChange}
            style={{ flex: 1, padding: "10px", border: "1px solid #ccc", borderRadius: "5px" }}
            required
          />
        </div>
        <input
          type="text"
          name="subject"
          placeholder="Subject"
          value={formData.subject}
          onChange={handleChange}
          style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "5px", marginBottom: "10px" }}
          required
        />
        <textarea
          name="message"
          placeholder="Message"
          value={formData.message}
          onChange={handleChange}
          style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "5px", height: "100px", marginBottom: "10px" }}
          required
        />
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#6c5ce7",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          Send Message <span style={{ marginLeft: "10px" }}>➡️</span>
        </button>
      </form>
    </div>
  );
};

export default ContactUsForm;
