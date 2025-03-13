import React from "react";
import { Calendar, PlusCircle, Edit } from "lucide-react"; // Import Lucide icons
import "../index.css"; // Import the CSS file

const AdminHome = () => {
  return (
    <div className="admin-home">
      <div className="welcome-section">
        <h1>Welcome to the Admin Dashboard</h1>
        <p>Here you can manage your events and view important information.</p>
      </div>
      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-cards">
          <div className="action-card">
            <Calendar className="action-icon" />
            <h3>View and Manage Events</h3>
            <p>Check out all the events and manage them efficiently.</p>
          </div>
          <div className="action-card">
            <PlusCircle className="action-icon" />
            <h3>Add New Events</h3>
            <p>Create and publish new events for your community.</p>
          </div>
          <div className="action-card">
            <Edit className="action-icon" />
            <h3>Update Event Details</h3>
            <p>Edit and update event information as needed.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHome;