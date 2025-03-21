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
    <div className="contact-form-container">
      <div className="contact-form-image">
        <img src={defaultEventImg} alt="Contact Us" />
      </div>
      <form onSubmit={handleSendEmail} className="contact-form">
        <h2>यदि आपके कोई प्रश्न हैं, तो कृपया हमसे संपर्क करें।</h2>
        <div className="form-row">
          <input
            type="text"
            name="name"
            placeholder="आपका नाम"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <input
            type="tel"
            name="phoneNo"
            placeholder="आपका मोबाइल"
            value={formData.phoneNo}
            onChange={handleChange}
            required
          />
        </div>
        <input
          type="text"
          name="subject"
          placeholder="Subject"
          value={formData.subject}
          onChange={handleChange}
          required
        />
        <textarea
          name="message"
          placeholder="संदेश"
          value={formData.message}
          onChange={handleChange}
          required
        />
        <button style={{backgroundColor:"#FFD700",color:"black"}} type="submit">
        संदेश भेजें <span>➡️</span>
        </button>
      </form>
    </div>
  );
};

export default ContactUsForm;