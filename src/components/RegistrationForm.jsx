import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { databases } from "../appwriteConfig";
import "../styles/RegistrationForm.css";
import { toast } from "react-toastify";

const RegistrationForm = () => {
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    fatherHusbandName: "",
    dob: "",
    gender: "",
    maritalStatus: "",
    contactAddress: "",
    mobileNumber: "",
    email: "",
    aadharNumber: "",
    stateName: "",
    districtName: "",
    villageCityName: "",
    occupation: "",
    bloodGroup: "",
    qualification: "",
    designation: "", // Added Designation field
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsRegistering(true);
      await databases.createDocument(
        "67cff2840013b293be3c",
        "67d301a8000b5dd7e089",
        "unique()",
        formData
      );
      toast.success("Registration Successful!");
      navigate("/");
      setIsRegistering(false);
    } catch (error) {
      console.error("Error registering:", error);
      toast.error("Error registering:", error);
      setIsRegistering(false);
    }
  };

  const leftColumnFields = [
    { name: "name", label: "पूरा नाम" },
    { name: "fatherHusbandName", label: "पिता/पति का नाम" },
    { name: "dob", label: "जन्म तिथि", type: "date" },
    {
      name: "gender",
      label: "लिंग",
      type: "select",
      options: ["पुरुष", "महिला", "अन्य"],
    },
    {
      name: "maritalStatus",
      label: "वैवाहिक स्थिति",
      type: "select",
      options: ["अविवाहित", "विवाहित", "तलाकशुदा", "विधवा/विधुर"],
    },
    { name: "contactAddress", label: "संपर्क पता" },
    { name: "mobileNumber", label: "मोबाइल नंबर", type: "tel" },
    { name: "designation", label: "पदनाम" }, // Added Designation field
  ];
  
  const rightColumnFields = [
    { name: "email", label: "ईमेल पता", type: "email" },
    { name: "aadharNumber", label: "आधार नंबर" },
    { name: "stateName", label: "राज्य का नाम" },
    { name: "districtName", label: "जिला का नाम" },
    { name: "villageCityName", label: "गांव/शहर का नाम" },
    { name: "occupation", label: "पेशा" },
    { name: "bloodGroup", label: "रक्त समूह" },
    { name: "qualification", label: "योग्यता" },
  ];
  

  const renderField = (field) => {
    switch (field.type) {
      case "select":
        return (
          <select
            name={field.name}
            value={formData[field.name]}
            onChange={handleChange}
          >
            <option value="">Select {field.label}</option>
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      default:
        return (
          <input
            type={field.type || "text"}
            name={field.name}
            value={formData[field.name]}
            onChange={handleChange}
            
          />
        );
    }
  };

  return (
    <div className="registration-container">
      <h2>पंजीकरण फ़ॉर्म</h2>
      <br />

      <form onSubmit={handleSubmit} className="registration-form">
        <div className="form-columns">
          <div className="form-column left-column">
            {leftColumnFields.map((field) => (
              <div className="form-group" key={field.name}>
                <label htmlFor={field.name}>{field.label}:</label>
                {renderField(field)}
              </div>
            ))}
          </div>

          <div className="form-column right-column">
            {rightColumnFields.map((field) => (
              <div className="form-group" key={field.name}>
                <label htmlFor={field.name}>{field.label}:</label>
                {renderField(field)}
              </div>
            ))}
          </div>
        </div>

        <div className="form-group full-width">
          <button type="submit">
            {isRegistering ? (
              <div className="spinner"></div>
            ) : (
              "पंजीकरण सबमिट करें"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegistrationForm;