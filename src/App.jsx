import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "react-datepicker/dist/react-datepicker.css";
import Home from "./pages/Home";
import About from "./pages/About";
import Services from "./components/Services";
import Objective from "./components/Objective";
import Donate from "./pages/donate";
import Testimonials from "./components/Testimonials";
import Events from "./pages/Events";
import EventDetails from "./pages/EventDetails"; // Import EventDetails page
import CommunityTable from "./components/Members";
import CoreCommunityTable from "./components/coreMembers";

import Admin from "./pages/Admin";
import Login from "./pages/Login";
import AdminHome from "./pages/AdminHome";
import EventsPage from "./components/EventPage";
import EventForm from "./components/EventForm";
import RegistrationRequests from "./pages/RegistrationRequests";
import ProtectedRoute from "./components/ProtectedRoute";
import RegistrationForm from "./components/RegistrationForm";

function App() {
  return (
    <>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/events" element={<Events />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/objective" element={<Objective />} />
          <Route path="/donate" element={<Donate />} />
          <Route path="/testimonials" element={<Testimonials />} />
          <Route path="/events/:eventId" element={<EventDetails />} />
          <Route path="/members" element={<CommunityTable />} />
          <Route path="/coremembers" element={<CoreCommunityTable />} />

          <Route path="/admin/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<AdminHome />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="events/edit/:id" element={<EventForm />} />
            <Route path="events/add" element={<EventForm />} />
            <Route path="member-request" element={<RegistrationRequests />} />
          </Route>
          <Route path="/registration" element={<RegistrationForm />} />
        </Routes>
      {/* Toast Container */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </>
  );
}

export default App;