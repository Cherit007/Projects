import React, { useState, useEffect } from "react";
import { Databases, ID } from "appwrite";
import { databases, storage } from "../appwriteConfig"; // Import storage
import { toast, ToastContainer } from "react-toastify"; // Import toast for notifications
import "react-toastify/dist/ReactToastify.css"; // Toast CSS
import DatePicker from "react-datepicker"; // Import date picker
import "react-datepicker/dist/react-datepicker.css"; // Date picker CSS
import { useParams, useNavigate } from "react-router-dom"; // Import useParams and useNavigate
import "../index.css";

const EventForm = ({ onUpdate }) => {
  const { id } = useParams(); // Get the event ID from the URL
  const navigate = useNavigate();
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDateTime, setEventDateTime] = useState(new Date());
  const [eventImage, setEventImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch event data if in edit mode
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
    if (id) {
      const fetchEvent = async () => {
        try {
          const response = await databases.getDocument(
            "67cff2840013b293be3c", // Replace with your database ID
            "67cff28f0032d7a0fbbf", // Replace with your collection ID
            id // Event ID from the URL
          );
          setEventName(response.title);
          setEventDescription(response.description);
          setEventLocation(response.location);
          setEventDateTime(new Date(response.date));
          setImagePreview(response.image);
        } catch (error) {
          console.error("Error fetching event:", error);
          toast.error("Failed to fetch event details. Please try again.");
        }
      };
      fetchEvent();
    }
  }, [id]);

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
      // Upload image to Appwrite Storage (if a new image is selected)
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

      const eventData = {
        title: eventName,
        description: eventDescription,
        location: eventLocation,
        date: eventDateTime.toISOString(),
        image: imageUrl,
      };

      if (id) {
        // Update existing event
        const response = await databases.updateDocument(
          "67cff2840013b293be3c", // Database ID
          "67cff28f0032d7a0fbbf", // Collection ID
          id, // Event ID from the URL
          eventData
        );
        toast.success("Event updated successfully!");
        // Call the onUpdate function
      } else {
        // Create new event
        const response = await databases.createDocument(
          "67cff2840013b293be3c", // Database ID
          "67cff28f0032d7a0fbbf", // Collection ID
          ID.unique(), // Auto-generate document ID
          eventData
        );
        toast.success("Event created successfully!");
      }
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
      setTimeout(() => {
        navigate("/admin/events"); // Redirect to the events list
      }, 1000);
    } catch (error) {
      console.error("Error saving event:", error);
      toast.error(
        `Failed to ${id ? "update" : "create"} event. Please try again.`
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="event-form-container">
      <h2>{id ? "Update Event" : "Add New Event"}</h2>
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
          ) : id ? (
            "Update Event"
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
