import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/Events.css";
import { databases } from "../appwriteConfig";
import defaultEventImg from "/img/default_event.png";

const Events = () => {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("all");

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

  const today = new Date().setHours(0, 0, 0, 0);

  const liveEvents = events.filter((event) => {
    const eventDate = new Date(event.date).setHours(0, 0, 0, 0);
    return eventDate === today;
  });

  const upcomingEvents = events.filter((event) => new Date(event.date) > today);
  const expiredEvents = events.filter((event) => new Date(event.date) < today);

  const filteredEvents =
    filter === "live"
      ? liveEvents
      : filter === "upcoming"
      ? upcomingEvents
      : filter === "expired"
      ? expiredEvents
      : events;

  return (
    <div className="events-page">
      <div className="banner">
        <img
          src="https://fastly.picsum.photos/id/564/200/300.jpg?hmac=GML84ZsOUsd0_XLIMleR9RvRFT8-pojH0AwU7tRHoCg"
          alt="Events Banner"
        />
        <div className="banner-text">
          <h1>Upcoming Events</h1>
          <p>Discover the latest events happening near you!</p>
        </div>
      </div>

      <div className="filter-container">
        <br />
        <br />
        <br />

        <label htmlFor="filter">Filter Events:</label>
        <select
          id="filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All Events</option>
          <option value="live">Live Events</option>
          <option value="upcoming">Upcoming Events</option>
          <option value="expired">Expired Events</option>
        </select>
      </div>

      <div className="events-container">
        <div className="events-grid">
          {filteredEvents.map((event) => (
            <div key={event.$id} className="event-card">
              <img
                src={event.image || defaultEventImg}
                alt={event.title}
                className="event-image-1"
              />
              <div className="event-content">
                <h3>{event.title}</h3>
                <p className="event-description-snippet">
                  {event.description
                    ? event.description.length > 150
                      ? `${event.description.slice(0, 100)}...`
                      : event.description
                    : "No details available"}
                </p>{" "}
                <p className="event-date">
                  📅 {new Date(event.date).toDateString()}
                </p>
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

// // title
// // string
// // -
// // description
// // string
// // -
// // date
// // datetime
// // -
// // location
// // string
// // -
// // image
// // url
// // -
// // createdAt
// // datetime
// // -
// // eventdetails
// // string
// // -
