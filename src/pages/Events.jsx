import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/Events.css"; 
import { databases } from "../appwriteConfig"; 
import defaultEventImg from '/img/default_event.png'

const Events = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    databases
      .listDocuments("67cff2840013b293be3c", "67cff28f0032d7a0fbbf")
      .then((response) => {
        setEvents(response.documents);
      })
      .catch((error) => {
        console.error("Error fetching events:", error);
      });
  }, []);

  return (
    <div className="events-page">
      <div className="banner">
        <img src="https://fastly.picsum.photos/id/564/200/300.jpg?hmac=GML84ZsOUsd0_XLIMleR9RvRFT8-pojH0AwU7tRHoCg" alt="Events Banner" />
        <div className="banner-text">
          <h1>Upcoming Events</h1>
          <p>Discover the latest events happening near you!</p>
        </div>
      </div>

      <div className="events-container">
        <h2>🎉 Upcoming Events</h2>
        <div className="events-grid">
          {events.map((event) => (
            <div key={event.$id} className="event-card">
              <img
                src={event.image || defaultEventImg}
                alt={event.title}
                className="event-image"
              />
              <div className="event-content">
                <h3>{event.title}</h3>
                <p>{event.description}</p>
                <p className="event-date">📅 {new Date(event.date).toDateString()}</p>
                <Link to={`/events/${event.$id}`} className="learn-more-btn">
                  Learn More
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Events;


// title
// string
// -
// description
// string
// -
// date
// datetime
// -
// location
// string
// -
// image
// url
// -
// createdAt
// datetime
// -
// eventdetails
// string
// -