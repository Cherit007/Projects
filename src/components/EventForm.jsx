import React, { useState, useEffect } from "react";
import { Databases, ID } from "appwrite";
import { databases, storage } from "../appwriteConfig"; // Import storage
import { toast, ToastContainer } from "react-toastify"; // Import toast for notifications
import "react-toastify/dist/ReactToastify.css"; // Toast CSS
import DatePicker from "react-datepicker"; // Import date picker
import "react-datepicker/dist/react-datepicker.css"; // Date picker CSS
import "../index.css";

const EventForm = () => {
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDateTime, setEventDateTime] = useState(new Date()); // Combined date and time
  const [eventImage, setEventImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null); // State for image preview
  const [isUploading, setIsUploading] = useState(false);

  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEventImage(file);
      setImagePreview(URL.createObjectURL(file)); // Generate image preview
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      // Upload image to Appwrite Storage
      let imageUrl = "";
      if (eventImage) {
        const fileUploadResponse = await storage.createFile(
          "67d1ccb0002c6f93d356", // Replace with your bucket ID
          ID.unique(), // Auto-generate file ID
          eventImage
        );

        // Get the file URL
        const fileUrl = storage.getFilePreview("67d1ccb0002c6f93d356", fileUploadResponse.$id);
        imageUrl = fileUrl;
      }

      // Push data to Appwrite database
      const response = await databases.createDocument(
        "67cff2840013b293be3c", // Database ID
        "67cff28f0032d7a0fbbf", // Collection ID
        ID.unique(), // Auto-generate document ID
        {
          title: eventName,
          description: eventDescription,
          location: eventLocation,
          date: eventDateTime.toISOString(), // Convert date and time to ISO string
          image: imageUrl,
          eventdetails:
            "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.",
          createdAt: new Date(),
        }
      );

      console.log("Event created successfully:", response);

      // Show toast notification
      toast.success("Event created successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      // Reset form fields
      setEventName("");
      setEventDescription("");
      setEventLocation("");
      setEventDateTime(new Date()); // Reset date and time to current
      setEventImage(null);
      setImagePreview(null); // Clear image preview
      document.getElementById("fileInput").value = ""; // Clear file input

      // Scroll to bottom after adding the event
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      console.error("Error creating event:", error);

      // Show error toast
      toast.error("Failed to create event. Please try again.", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="event-form-container">
      <h2>Add New Event</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Event Name:</label>
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Event Description:</label>
          <textarea
            value={eventDescription}
            onChange={(e) => setEventDescription(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Event Location:</label>
          <input
            type="text"
            value={eventLocation}
            onChange={(e) => setEventLocation(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Event Date and Time:</label>
          <DatePicker
            selected={eventDateTime}
            onChange={(date) => setEventDateTime(date)}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            timeCaption="Time"
            dateFormat="MMMM d, yyyy h:mm aa"
            minDate={new Date()} // Prevent selecting past dates
            className="date-picker"
          />
        </div>
        <div className="form-group">
          <label>Event Image:</label>
          <input
            id="fileInput"
            type="file"
            onChange={handleImageChange}
            accept="image/*"
          />
          {imagePreview && (
            <div className="image-preview">
              <img src={imagePreview} alt="Event Preview" />
            </div>
          )}
        </div>
        <button type="submit" className="submit-button" disabled={isUploading}>
          {isUploading ? (
            <div className="spinner"></div> // Show spinner when uploading
          ) : (
            "Add Event"
          )}
        </button>
      </form>
      <ToastContainer /> {/* Toast container for notifications */}
    </div>
  );
};

export default EventForm;