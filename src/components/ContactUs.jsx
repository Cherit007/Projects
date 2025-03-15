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
      if (!formData.name  || !formData.phoneNo) {
        // setError(true);
        return;
      }
      formData.service='community';
      // setError(false);
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
        // setMailStatus(true);
        console.log("Form successfully submitted:", result);
        setFormData({
          name: "",
          subject: "",
          message: "",
          phoneNo: "",
        });
        toast.success('Email sent successfully!', {
          position: 'top-right',
          autoClose: 3000, // 3 seconds
        });
        setTimeout(() => {
          // setMailStatus(false);
        }, 2000);
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
 {/* <img src={defaultEventImg} alt="Contact Us" style={{ width: "200px", height: "auto" }} /> */}
  return (
<div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center"}}>
 <img src={defaultEventImg} alt="Contact Us" style={{ width: "200px", height: "auto" }} />

  <form onSubmit={handleSendEmail} style={{ width: "100%", maxWidth: "1000px", padding: "20px" }}>
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
        name="phoneNo"
        placeholder="Your Mobile"
        value={formData.phoneNo}
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
