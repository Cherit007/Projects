import React from "react";
import changeImage from './change.jpg';

const ObjectivesSection = () => {
  return (
    <section style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backgroundColor: "white" }}>
      {/* Image on the left */}
      <div style={{ flex: "1", display: "flex", justifyContent: "center" }}>
        <img
          src={changeImage}
          alt="Make a Change"
          style={{ width: "70%", maxWidth: "300px", borderRadius: "10px", boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)" }}
        />
      </div>

      {/* Objectives text on the right */}
      <div style={{ flex: "1", padding: "20px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#333" }}>Our Objectives-</h2>
        <div style={{
          backgroundColor: "#f3f3f3",
          padding: "15px",
          borderRadius: "10px",
          boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
          marginTop: "10px",
          borderLeft: "5px solid purple"
        }}>
          <p style={{ color: "#555", fontSize: "14px", lineHeight: "1.6" }}>
            To make the society socially, economically, religiously, culturally, and mentally prosperous. 
            To eliminate the prevalent evil practices in the society like:- death feast, child marriage, 
            dowry system, and untouchability. To stop and free the people of the society from consuming alcohol, 
            gutkha, tobacco, etc. To establish a relief fund in the society and help the weak, backward, and poor 
            people of the society and make them economically strong. To provide guidance to the youth of the society 
            for higher education, government jobs, and to establish business. To try to maintain a clean environment 
            in the country and society and to stop the caste-based exploitation, atrocities, and crimes against the 
            people of the society by uniting. To build character and awaken the feeling of nationalism in the society etc.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ObjectivesSection;
