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
      {/* <header className="core-member-header"> */}
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
      {/* </header> */}
      <h1 style={{ textAlign: "center" }}>{member.name}</h1>
      <h3 style={{ fontSize:"20px", textAlign: "center" ,color:"#555"}}>{member.designation}</h3>

      <div className="core-member-container">
        <img
          src={`${member.image}`}
          alt={member.name}
          className="core-member-image"
        />
        <div className="core-member-info">
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
