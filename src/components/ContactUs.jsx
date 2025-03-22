import React, { useState } from "react";
import defaultEventImg from '/img/contact.avif';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ContactUsForm = () => {
  const [formData, setFormData] = useState({
    name: "",
    phoneNo: "",
    subject: "",
    message: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    try {
      if (!formData.name || !formData.phoneNo) {
        return;
      }
      formData.service = 'community';
      const response = await fetch(
        "https://mail-service-ike3.onrender.com/submit-form",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );
      if (response.ok) {
        const result = await response.json();
        console.log("Form successfully submitted:", result);
        setFormData({
          name: "",
          subject: "",
          message: "",
          phoneNo: "",
        });
        toast.success('Email sent successfully!', {
          position: 'top-right',
          autoClose: 3000,
        });
      } else {
        console.error("Form submission failed:", response.statusText);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error('Error sending email. Try again!', {
        position: 'top-right',
        autoClose: 3000,
      });
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Contact Logo at the Top */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <img
          src={defaultEventImg}
          alt="Contact Us"
          style={{ width: "100px", height: "auto", borderRadius: "50%" }}
        />
      </div>

      {/* Form and Google Maps Side by Side */}
      <div
      className="footer-main"
      >
        {/* Contact Form */}
        <div
          style={{
            flex: 1,
            padding: "20px",
            backgroundColor: "#f9f9f9",
            borderRadius: "10px",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
          }}
        >
          <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
            यदि आपके कोई प्रश्न हैं, तो कृपया हमसे संपर्क करें।
          </h2>
          <form onSubmit={handleSendEmail} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="text"
                name="name"
                placeholder="आपका नाम"
                value={formData.name}
                onChange={handleChange}
                required
                style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "5px" }}
              />
              <input
                type="tel"
                name="phoneNo"
                placeholder="आपका मोबाइल"
                value={formData.phoneNo}
                onChange={handleChange}
                required
                style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "5px" }}
              />
            </div>
            <input
              type="text"
              name="subject"
              placeholder="Subject"
              value={formData.subject}
              onChange={handleChange}
              required
              style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "5px" }}
            />
            <textarea
              name="message"
              placeholder="संदेश"
              value={formData.message}
              onChange={handleChange}
              required
              style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "5px", height: "100px" }}
            />
            <button
              type="submit"
              style={{
                backgroundColor: "#FFD700",
                color: "black",
                padding: "10px",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              Send Message <span>➡️</span>
            </button>
          </form>
        </div>

        {/* Google Maps */}
        <div
          style={{
            flex: 1,
            borderRadius: "10px",
            overflow: "hidden",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
          }}
        >
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3603.3606224167142!2d81.97775838754751!3d25.426204391796603!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x398ff9194a0dec6d%3A0xb672568d707ea2a!2sGrand%20Trunk%20Rd%2C%20Uttar%20Pradesh!5e0!3m2!1sen!2sin!4v1742653407015!5m2!1sen!2sin"
            width="100%"
            height="450"
            style={{ border: "0" }}
            allowFullScreen
            loading="lazy"
          ></iframe>
        </div>
      </div>
    </div>
  );
};

export default ContactUsForm;