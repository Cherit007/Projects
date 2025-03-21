import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const CoreMemberDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const member = location.state?.member;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!member) {
    return <p>Member not found.</p>;
  }

  return (
    <div className="core-member-details">
      <header className="core-member-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h2>{member.name}</h2>
      </header>

      <div className="core-member-container">
        <img
          src={`${member.image}`}
          alt={member.name}
          className="core-member-image"
        />
        <div className="core-member-info">
          <h3>{member.designation}</h3>
          <h4>परिचय</h4>
          <p style={{ whiteSpace: "pre-line" }}>{member.details}</p>
          <h4>उपलब्धियाँ</h4>
          <p style={{ whiteSpace: "pre-line" }}>{member.achievements}</p>
        </div>
      </div>
    </div>
  );
};

export default CoreMemberDetails;
