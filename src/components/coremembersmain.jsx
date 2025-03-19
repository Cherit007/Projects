import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";

const membersData = [
  { 
    id: 1, 
    name: "Shri Sajjan Singh Verma", 
    designation: "Ex. Cabinet Minister, Ex. Member of Parliament, Madhya Pradesh", 
    image: "src/assets/sajjan.jpg", 
    details: "Shri Sajjan Singh Verma is a distinguished leader whose legacy as a former Cabinet Minister and Member of Parliament from Madhya Pradesh has left an indelible mark on the political landscape of the nation. With a strong commitment to public service, he has been at the forefront of driving progressive policies that have empowered communities and contributed to the growth and development of his constituency.In addition to his remarkable political career, Shri Sajjan Singh Verma serves as the National President of the Khatik Samaj, where his leadership continues to inspire and uplift the community. His unwavering dedication to the development of the Khatik Samaj has led to transformative changes across various sectors, with a particular focus on education, politics, and business.",
    achievements: "As a visionary leader, Shri Sajjan Singh Verma is actively working to create equal opportunities for the members of the Khatik Samaj, enabling them to thrive and succeed in all aspects of life. Through his tireless efforts, he has facilitated access to quality education, empowered aspiring entrepreneurs, and encouraged political engagement, ensuring that the community is not only well-represented but also contributes meaningfully to the progress of the nation.Under his leadership, the Khatik Samaj has witnessed a significant shift, from a marginalized group to one that is rapidly advancing in various fields. Shri [Leader's Name] is committed to providing the resources, mentorship, and support necessary for individuals within the community to excel, be it in their professional endeavors, political careers, or business ventures."
  },
  { 
    id: 2, 
    name: "Munshiram Pal Ji", 
    designation: "former Member of Parliament ,member of the Rashtriya Lok Dal", 
    image: "src/assets/munshiram.jpg", 
    details: "Munshiram Pal Ji is a distinguished leader, a former Member of Parliament from Bijnor, and a dedicated member of the Rashtriya Lok Dal, serving the people of Nagina District, Bijnor, Uttar Pradesh, with unwavering commitment. With a career spanning decades, Munshiram Pal Ji has been a pillar of strength for his community and has contributed immensely to the political landscape of Uttar Pradesh.Educated at the prestigious U.P. Board of High School & Intermediate Education in Allahabad from 1974 to 1976, Munshiram Pal Ji has always valued education as a means of empowerment. His academic background laid a strong foundation for his leadership, which has inspired countless individuals in his community.",
    achievements: "For the past 40 years, Munshiram Pal Ji has been a guiding force for the Akhil Bharatiya Khatik Samaj, working tirelessly as its Chief Patron to uplift and empower the Khatik community. His leadership has transformed lives, helping community members gain access to education, employment opportunities, and political representation. His contributions have not only provided a platform for the community to thrive but also ensured that its voices are heard at all levels of government.The Khatik community is truly fortunate to have a leader like Munshiram Pal Ji, whose decades of service and dedication continue to shape the future of the community. His efforts have made a lasting impact, and his commitment to the cause remains unwavering as he works towards a brighter, more prosperous future for the Khatik Samaj."
  },
  { 
    id: 3, 
    name: "Alice Brown", 
    designation: "CFO", 
    image: "src/assets/download.jpg", 
    details: "Alice Brown manages our financial strategies with precision and foresight. Her expertise in financial planning has been instrumental in our consistent growth and profitability. She oversees all aspects of our financial operations, including investment strategies, risk management, and financial reporting.",
    achievements: "CPA, Former Investment Banker, Led 3 successful IPOs"
  },
  { 
    id: 4, 
    name: "Bob White", 
    designation: "COO", 
    image: "src/assets/download.jpg", 
    details: "Bob White optimizes our operational workflows and ensures seamless execution across all departments. His methodical approach to operations management has significantly improved our efficiency and scalability. He works closely with all teams to implement best practices and continuous improvement processes.",
    achievements: "Six Sigma Black Belt, MBA from Wharton, Reduced operational costs by 30%"
  },
  { 
    id: 5, 
    name: "Emma Green", 
    designation: "CMO", 
    image: "src/assets/download.jpg", 
    details: "Emma Green directs our marketing initiatives with creativity and data-driven strategies. Her innovative campaigns have substantially increased our brand recognition and market penetration. She leads a talented team of marketing professionals who excel in digital marketing, content creation, and brand development.",
    achievements: "Digital Marketing Award 2023, Former Marketing Director at Fortune 100 company, 200% ROI on marketing campaigns"
  }
];

const CoreMembersMain = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  const itemsPerPage = 3; // Show 3 cards on larger devices
  const totalPages = Math.ceil(membersData.length / itemsPerPage);

  // Auto-scroll functionality
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalPages);
    }, 5000); // Auto-scroll every 5 seconds

    return () => clearInterval(interval);
  }, [currentIndex, totalPages]);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % totalPages);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
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
        <button className="nav-button left" onClick={prevSlide}>
          <FaArrowLeft />
        </button>

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

        <button className="nav-button right" onClick={nextSlide}>
          <FaArrowRight />
        </button>
      </div>
    </div>
  );
};

export default CoreMembersMain;