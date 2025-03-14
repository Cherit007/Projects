import React, { useState, useEffect } from "react";
import { Databases } from "appwrite";
import { client } from "../appwriteConfig"; // Import Appwrite client
import EventCard from "./EventCard";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Link, useNavigate } from "react-router-dom";
import Loader from "./Loader";

const EventsPage = () => {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState("all"); // Default filter is "all"
  const navigate = useNavigate();

  // Initialize Appwrite Database
  const databases = new Databases(client);

  // Fetch events from Appwrite
  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const response = await databases.listDocuments(
        "67cff2840013b293be3c", // Replace with your database ID
        "67cff28f0032d7a0fbbf" // Replace with your collection ID
      );
      setEvents(response.documents);
      setFilteredEvents(response.documents); // Initialize filtered events
    } catch (error) {
      console.error("Error fetching events:", error);
      toast.error("Failed to fetch events. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete an event
  const handleDeleteEvent = async (eventId) => {
    try {
      await databases.deleteDocument(
        "67cff2840013b293be3c", // Replace with your database ID
        "67cff28f0032d7a0fbbf", // Replace with your collection ID
        eventId
      );
      setEvents(events.filter((event) => event.$id !== eventId));
      setFilteredEvents(filteredEvents.filter((event) => event.$id !== eventId));
      toast.success("Event deleted successfully!");
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event. Please try again.");
    }
  };

  // Handle event update
  const handleUpdateEvent = (updatedEvent) => {
    setEvents(
      events.map((event) =>
        event.$id === updatedEvent.$id ? updatedEvent : event
      )
    );
    setFilteredEvents(
      filteredEvents.map((event) =>
        event.$id === updatedEvent.$id ? updatedEvent : event
      )
    );
    navigate("/admin/events"); // Redirect back to the events list
  };

  // Filter events based on the selected filter
  const filterEvents = (filterType) => {
    const now = new Date();
    switch (filterType) {
      case "upcoming":
        setFilteredEvents(
          events.filter((event) => new Date(event.date) > now)
        );
        break;
      case "expired":
        setFilteredEvents(
          events.filter((event) => new Date(event.date) < now)
        );
        break;
      case "live":
        setFilteredEvents(
          events.filter(
            (event) =>
              new Date(event.date) <= now &&
              new Date(event.date).getTime() + 24 * 60 * 60 * 1000 > now // Events within 24 hours are considered "live"
          )
        );
        break;
      default:
        setFilteredEvents(events); // Show all events
        break;
    }
  };

  // Handle filter change
  const handleFilterChange = (filterType) => {
    setFilter(filterType);
    filterEvents(filterType);
  };

  // Fetch events on component mount
  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <div className="events-page">
      <h2>Events</h2>
      {/* Filter Dropdown */}
      <div className="filter-container">
        <label>Filter by:</label>
        <select
          value={filter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="filter-dropdown"
        >
          <option value="all">All Events</option>
          <option value="upcoming">Upcoming Events</option>
          <option value="expired">Expired Events</option>
          <option value="live">Live Events</option>
        </select>
      </div>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          <div className="event-list">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.$id}
                event={event}
                onDelete={handleDeleteEvent}
              />
            ))}
          </div>
          <Link to="/admin/events/add" className="add-event-button">
            +
          </Link>
        </>
      )}
      {/* <ToastContainer /> */}
    </div>
  );
};

export default EventsPage;