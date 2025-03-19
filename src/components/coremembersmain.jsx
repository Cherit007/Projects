import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/CoreMembers.css";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";

const membersData = [
  { 
    id: 1, 
    name: "John Doe", 
    designation: "CEO", 
    image: "src/assets/person1.jpg", 
    details: "John Doe is our visionary CEO with over 15 years of industry experience. He founded our company in 2010 with a mission to revolutionize the industry through innovative solutions and customer-centric approaches. Under his leadership, we've expanded to 5 countries and grown our team to over 200 dedicated professionals.",
    achievements: "MBA from Harvard Business School, Fortune 500 leadership experience, Awarded Entrepreneur of the Year 2022"
  },
  { 
    id: 2, 
    name: "Jane Smith", 
    designation: "CTO", 
    image: "src/assets/person1.jpg", 
    details: "Jane Smith leads our technology initiatives with her extensive background in software architecture and system design. She has pioneered several of our flagship products and continues to drive technical innovation across all our platforms. Her forward-thinking approach has helped us stay ahead of industry trends.",
    achievements: "PhD in Computer Science, 25+ patents, Former Senior Engineer at Google"
  },
  { 
    id: 3, 
    name: "Alice Brown", 
    designation: "CFO", 
    image: "src/assets/person1.jpg", 
    details: "Alice Brown manages our financial strategies with precision and foresight. Her expertise in financial planning has been instrumental in our consistent growth and profitability. She oversees all aspects of our financial operations, including investment strategies, risk management, and financial reporting.",
    achievements: "CPA, Former Investment Banker, Led 3 successful IPOs"
  },
  { 
    id: 4, 
    name: "Bob White", 
    designation: "COO", 
    image: "src/assets/person1.jpg", 
    details: "Bob White optimizes our operational workflows and ensures seamless execution across all departments. His methodical approach to operations management has significantly improved our efficiency and scalability. He works closely with all teams to implement best practices and continuous improvement processes.",
    achievements: "Six Sigma Black Belt, MBA from Wharton, Reduced operational costs by 30%"
  },
  { 
    id: 5, 
    name: "Emma Green", 
    designation: "CMO", 
    image: "src/assets/person1.jpg", 
    details: "Emma Green directs our marketing initiatives with creativity and data-driven strategies. Her innovative campaigns have substantially increased our brand recognition and market penetration. She leads a talented team of marketing professionals who excel in digital marketing, content creation, and brand development.",
    achievements: "Digital Marketing Award 2023, Former Marketing Director at Fortune 100 company, 200% ROI on marketing campaigns"
  }
];

const CoreMembersMain = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  const itemsPerPage = 3;
  const totalPages = Math.ceil(membersData.length / itemsPerPage);

  const nextSlide = () => {
    if (currentIndex < totalPages - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Calculate which members to display based on current index
  const visibleMembers = membersData.slice(
    currentIndex * itemsPerPage,
    (currentIndex + 1) * itemsPerPage
  );

  return (
    <div className="core-members">
      <h2 className="core-members-heading">Core Members</h2>
      <p className="core-members-subtext">Meet our talented and dedicated team members.</p>

      <div className="scrollable-banner-container">
        <div className="scrollable-banner">
          {visibleMembers.map((member) => (
            <div key={member.id} className="member-card">
              <div className="member-image-container">
                <img src={member.image} alt={member.name} className="member-image" />
              </div>
              <p className="member-name">{member.name}</p>
              <p className="member-designation">{member.designation}</p>
              <button 
                className="show-more-button" 
                onClick={() => navigate(`/core-member/${member.id}`, { state: { member } })}
              >
                View More
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="navigation-buttons">
        <button className="nav-button" onClick={prevSlide} disabled={currentIndex === 0}><FaArrowLeft /></button>
        <button className="nav-button" onClick={nextSlide} disabled={currentIndex === totalPages - 1}><FaArrowRight /></button>
      </div>
    </div>
  );
};

export default CoreMembersMain;
