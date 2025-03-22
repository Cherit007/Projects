import React from "react";
import Footer from "../components/Footer";
import about1 from "/img/about1.jpg";
import about2 from "/img/about2.jpg";

const About = () => {
  const containerStyle = {
    // maxWidth: "1000px",
    margin: "0 auto",
    padding: "20px",
    background: "linear-gradient(to bottom, #fff8e1, #ffffff)", // Cream to white
    borderRadius: "10px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  };

  const sectionStyle = {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    marginTop: "30px",
    padding: "20px",
    borderRadius: "10px",
    background: "#ffffff",
    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
  };

  const textContainerStyle = {
    flex: 1,
    textAlign: "justify",
  };

  const headingStyle = {
    fontSize: "22px",
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: "20px",
    color: "#ffb300", // Golden yellow heading
  };

  const paragraphStyle = {
    fontSize: "16px",
    color: "#444",
    lineHeight: "1.6",
  };

  const imageStyle = {
    width: "100%",
    maxWidth: "300px",
    height: "auto",
    borderRadius: "10px",
    border: "3px solid #ffb300", // Golden yellow border
  };

  return (
    <div style={containerStyle}>
      <h1
        style={{
          fontSize: "26px",
          fontWeight: "bold",
          textAlign: "center",
          background: "linear-gradient(to right, #ffb300, #f57c00)", // Golden yellow gradient
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
       हमारा समुदाय के बारे में
      </h1>

      {/* About Community Section */}
      <div style={sectionStyle}>
        <div style={textContainerStyle}>
          <h2 style={headingStyle}>खटीक इतिहास</h2>
          <p style={paragraphStyle}>
          खटीक उत्तर भारत में व्यापक रूप से फैला हुआ एक समुदाय है, और प्रत्येक खटीक समूह की अपनी एक अलग उत्पत्ति की कथा है। इन सभी में जो समानता है, वह यह है कि ऐतिहासिक रूप से वे क्षत्रिय थे, जिन्हें राजाओं द्वारा किए जाने वाले यज्ञों में पशु बलि देने का कार्य सौंपा गया था। आज भी, हिंदू मंदिरों में होने वाली बलि अर्पण की रस्म के दौरान केवल खटीकों को ही पशु बलि देने का अधिकार प्राप्त है।
          </p>
          <p style={paragraphStyle}>
          उनकी परंपराओं के अनुसार, भगवान ब्रह्मा ने उन्हें बकरी की खाल, पेड़ों की छाल और लाख प्रदान की, ताकि वे मवेशियों को चरा सकें, बकरियों और हिरणों की खाल को रंग सकें, और छाल व लाख का उपयोग करके चमड़े को संसाधित कर सकें।
          </p>
          <p style={{ ...paragraphStyle, fontWeight: "bold", color: "#f57c00" }}>
          एक अन्य परंपरा के अनुसार, खटीक शब्द की उत्पत्ति हिंदी शब्द "खट" से हुई है, जिसका अर्थ है तत्काल वध। अन्य स्रोतों का दावा है कि खटीक शब्द संस्कृत शब्द "कथिक" से आया है, जिसका अर्थ कसाई या शिकारी होता है।
          </p>
        </div>
        <img src={about1} alt="Community" style={imageStyle} />
      </div>

      {/* Our Vision Section */}
      <div style={sectionStyle}>
        <div style={textContainerStyle}>
          <h2 style={headingStyle}>Our Vision</h2>
          <p style={paragraphStyle}>
            हम, खटीक समुदाय के रूप में, एकता, सहयोग और सामूहिक प्रयासों के माध्यम से समाज को सशक्त बनाने के लिए प्रतिबद्ध हैं।
            हमारा उद्देश्य है कि हर सदस्य एक-दूसरे से जुड़ा रहे, मिलकर प्रगति करे और आने वाली पीढ़ियों के लिए एक उज्जवल भविष्य का निर्माण करे।
          </p>
          <p style={{ ...paragraphStyle, fontWeight: "bold", color: "#f57c00" }}>
            हमारी यह पहल आधुनिक तकनीक—मोबाइल एप्लिकेशन, वेबसाइट और अन्य डिजिटल साधनों—के माध्यम से समुदाय को एकजुट करने पर केंद्रित है।
          </p>
          <p
            style={{
              ...paragraphStyle,
              fontWeight: "bold",
              textAlign: "center",
              color: "#c62828", // Deep red for motivation
              fontSize: "18px",
            }}
          >
            सशक्त समाज, उज्जवल भविष्य! 🚀
          </p>
        </div>
        <img src={about2} alt="Vision" style={imageStyle} />
      </div>
    </div>
  );
};

export default About;
