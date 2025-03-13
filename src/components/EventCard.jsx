import React from "react";
import { Link } from "react-router-dom";
import defaultEventImg from '/img/default_event.png'

const EventCard = ({ event, onDelete }) => {
    const imageUrl = !event.image ? defaultEventImg :event.image;
    console.log(event.image);
  return (
    <div className="event-card">
      <div className="event-image">
        {imageUrl && <img src={imageUrl} alt={event.title} />}
      </div>
      <div className="event-details">
        <h3>{event.title}</h3>
        <p>{event.description}</p>
        <p><strong>Location:</strong> {event.location}</p>
        <p><strong>Date:</strong> {new Date(event.date).toLocaleString()}</p>
        <div className="event-actions">
          <Link to={`/admin/events/edit/${event.$id}`} className="edit-button">
            Edit
          </Link>
          <button onClick={() => onDelete(event.$id)} className="delete-button">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventCard;