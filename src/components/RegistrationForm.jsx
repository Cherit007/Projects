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
    { name: "name", label: "Full Name" },
    { name: "fatherHusbandName", label: "Father's/Husband's Name" },
    { name: "dob", label: "Date of Birth", type: "date" },
    {
      name: "gender",
      label: "Gender",
      type: "select",
      options: ["Male", "Female", "Other"],
    },
    {
      name: "maritalStatus",
      label: "Marital Status",
      type: "select",
      options: ["Single", "Married", "Divorced", "Widowed"],
    },
    { name: "contactAddress", label: "Contact Address" },
    { name: "mobileNumber", label: "Mobile Number", type: "tel" },
  ];

  const rightColumnFields = [
    { name: "email", label: "Email Address", type: "email" },
    { name: "aadharNumber", label: "Aadhar Number" },
    { name: "stateName", label: "State Name" },
    { name: "districtName", label: "District Name" },
    { name: "villageCityName", label: "Village/City Name" },
    { name: "occupation", label: "Occupation" },
    { name: "bloodGroup", label: "Blood Group" },
    { name: "qualification", label: "Qualification" },
  ];

  const renderField = (field) => {
    switch (field.type) {
      case "select":
        return (
          <select
            name={field.name}
            value={formData[field.name]}
            onChange={handleChange}
            required
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
            required
          />
        );
    }
  };

  return (
    <div className="registration-container">
      <h2>Registration Form</h2>
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
              "Submit Registration"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegistrationForm;
