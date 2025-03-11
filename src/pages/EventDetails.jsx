import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { databases } from "../appwriteConfig"; 

import "../styles/EventDetails.css"; 

const EventDetails = () => {
  const { eventId } = useParams(); 
  const [event, setEvent] = useState(null);
  const [timeLeft, setTimeLeft] = useState(""); 

  useEffect(() => {
    databases
      .getDocument("67cff2840013b293be3c", "67cff28f0032d7a0fbbf", eventId)
      .then((response) => {
        setEvent(response);
        if (response.date) {
          startCountdown(response.date);
        }
      })
      .catch((error) => {
        console.error("Error fetching event details:", error);
      });
  }, [eventId]);

  // Function to start countdown
  const startCountdown = (eventDate) => {
    const eventTime = new Date(eventDate).getTime();

    const updateTimer = () => {
      const currentTime = new Date().getTime();
      const timeDifference = eventTime - currentTime;

      if (timeDifference <= 0) {
        setTimeLeft("Event has started!");
        return;
      }

      const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor(
        (timeDifference % (1000 * 60 * 60)) / (1000 * 60)
      );
      const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  };

  if (!event) {
    return <p className="loading-text">Loading event details...</p>;
  }

  return (
    <div className="event-details-container">
      <h1 className="event-title">{event.title}</h1>
      <img
        src={event.image || "https://via.placeholder.com/600"}
        alt={event.title}
        className="event-image"
      />
      <p className="event-meta">
        📍 Location: {event.location || "TBA"} | 📅{" "}
        {event.date ? new Date(event.date).toDateString() : "TBA"}
      </p>
      <p className="countdown-timer">⏳ Countdown: {timeLeft}</p>
      <h2 className="event-details-heading">Event Details</h2>
      <p className="event-details-text">{event.eventdetails || "No details available"}</p>
    </div>
  );
};

export default EventDetails;
