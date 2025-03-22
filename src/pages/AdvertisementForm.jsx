import React, { useState } from "react";
import { Client, Databases, ID } from "appwrite";
import { databases, storage } from "../appwriteConfig";
import { toast } from "react-toastify";

const AdvertisementForm = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    message: "",
    title: "",
    publishDate: "",
    description: "",
    imageUrl: null,
  });
  const [eventImage, setEventImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Appwrite config

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEventImage(file);
      setImagePreview(URL.createObjectURL(file)); // Generate image preview
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsUploading(true);
      let imageUrl = imagePreview || "";
      if (eventImage) {
        const fileUploadResponse = await storage.createFile(
          "67d1ccb0002c6f93d356", // Replace with your bucket ID
          ID.unique(), // Auto-generate file ID
          eventImage
        );

        // Get the file URL
        const fileUrl = storage.getFilePreview(
          "67d1ccb0002c6f93d356",
          fileUploadResponse.$id
        );
        imageUrl = fileUrl;
      }
      await databases.createDocument(
        "67cff2840013b293be3c",
        "67def913003a9862aec3",
        ID.unique(),
        {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          message: formData.message,
          title: formData.title,
          publishDate: formData.publishDate,
          description: formData.description,
          imageUrl: imageUrl,
          // Handle image upload separately if needed
        }
      );
      toast.success("Advertisement submitted!");
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        message: "",
        title: "",
        publishDate: "",
        description: "",
        imageUrl: null,
      })
      setImagePreview(null)
    } catch (err) {
      console.error("Appwrite submission error:", err);
      toast.error("Failed to submit advertisement.");
    } finally {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
      setIsUploading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: "1000px",
        margin: "auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
          border: "1px solid #ccc",
          padding: "20px",
          borderRadius: "10px",
        }}
      >
        {/* Personal Details */}
        <div style={{ flex: "1", minWidth: "300px" }}>
          <h2 style={{ fontWeight: "bold", marginBottom: "15px" }}>
            Personal details
          </h2>
          <input
            type="text"
            name="firstName"
            placeholder="First Name"
            value={formData.firstName}
            onChange={handleChange}
            style={inputStyle}
            required
          />
          <input
            type="text"
            name="lastName"
            placeholder="Last Name"
            value={formData.lastName}
            onChange={handleChange}
            style={inputStyle}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email address"
            value={formData.email}
            onChange={handleChange}
            style={inputStyle}
            required
          />
          <input
            type="tel"
            name="phone"
            placeholder="Phone"
            value={formData.phone}
            onChange={handleChange}
            style={inputStyle}
            required
          />
          <textarea
            name="message"
            placeholder="Write your message"
            value={formData.message}
            onChange={handleChange}
            style={{ ...inputStyle, height: "80px" }}
          />
        </div>

        {/* Banner Details */}
        <div style={{ flex: "1", minWidth: "300px" }}>
          <h2 style={{ fontWeight: "bold", marginBottom: "15px" }}>
            Banner details
          </h2>
          <input
            type="text"
            name="title"
            placeholder="Title"
            value={formData.title}
            onChange={handleChange}
            style={inputStyle}
            required
          />
          <input
            type="date"
            name="publishDate"
            value={formData.publishDate}
            onChange={handleChange}
            style={inputStyle}
            required
          />
          <textarea
            name="description"
            placeholder="Write description about the advertisement"
            value={formData.description}
            onChange={handleChange}
            style={{ ...inputStyle, height: "80px" }}
            required
          />
        </div>

        {/* Image Upload */}
        <div style={{ width: "100%", textAlign: "center", marginTop: "20px" }}>
          <label style={uploadBoxStyle}>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: "none" }}
            />
            <div style={{ cursor: "pointer" }}>
              <div style={{ fontSize: "24px", marginBottom: "10px" }}>⬆️</div>
              <div>Upload image from your computer</div>
              <small>(JPG/PNG Format, Size must not exceed 10 MB)</small>
            </div>
          </label>

          {imagePreview && (
            <div style={{ marginTop: "20px" }}>
              <img
                src={imagePreview}
                alt="Preview"
                style={{
                  maxWidth: "300px",
                  borderRadius: "10px",
                  border: "1px solid #ccc",
                }}
              />
            </div>
          )}
        </div>

        {/* Submit */}
        <div style={{ width: "100%", textAlign: "center", marginTop: "30px" }}>
          <button
            disabled={isUploading}
            type="submit"
            style={submitButtonStyle}
          >
            {isUploading ? <div className="spinner"></div> : "Submit details"}
          </button>
        </div>
      </div>
    </form>
  );
};

// Inline styles
const inputStyle = {
  width: "100%",
  padding: "10px",
  marginBottom: "15px",
  borderRadius: "5px",
  border: "1px solid #ccc",
  fontSize: "16px",
};

const uploadBoxStyle = {
  border: "2px dashed #ccc",
  padding: "30px",
  borderRadius: "10px",
  display: "inline-block",
  width: "100%",
  maxWidth: "500px",
  textAlign: "center",
};

const submitButtonStyle = {
  backgroundColor: "#FFD700",
  padding: "10px 25px",
  fontSize: "16px",
  fontWeight: "bold",
  borderRadius: "5px",
  border: "none",
  cursor: "pointer",
};

export default AdvertisementForm;
