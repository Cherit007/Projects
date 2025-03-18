// import React from "react";
// import Footer from "../components/Footer";
import about1 from '/img/about1.jpg';
import about2 from '/img/about2.jpg';


import React from "react";
import Footer from "../components/Footer";

const About = () => {
  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", textAlign: "center" }}>About Our Community</h1>

      {/* About Community Section */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", marginTop: "30px" }}>
        {/* Left Side: Updated About Community Content */}
        <div style={{ flex: 1, textAlign: "justify" }}>
        <h2 style={{ fontSize: "22px", fontWeight: "bold", textAlign: "center", marginBottom: "20px" }}>Khatik History</h2>
          <p style={{ fontSize: "16px", color: "#555" }}>
            The Khatik are a widely distributed community in North India, and each Khatik group has its own origin myth. What they have in common is that they were historically Kshatriyas who were assigned to kill animals in yagas performed by kings. Today, only Khatiks have the right to kill animals during bali offerings at Hindu temples.
          </p>
          <p style={{ fontSize: "16px", color: "#555" }}>
            According to their traditions, the god Brahma assigned to them a goat's skin, the bark of trees, and lac—so they could graze cattle, dye skins of goats and deer, and tan hides with bark and lac.
          </p>
          <p style={{ fontSize: "16px", color: "#555" }}>
            Another tradition claims that the origin of the word Khatik has been derived from the Hindi word <b>khat</b>, which means an immediate killing. They relate this to the early days when they used to supply mutton to the kings of Rajasthan. Other sources claim that the word Khatik originated from the Sanskrit word <b>kathika</b>, meaning to butcher or hunt. The Khatik of Punjab used salt and the juice of the maddar tree (<i>Calotropis procera</i>) to tan and dye goat and sheep skin.
          </p>
        </div>
        
        {/* Right Side: Image 1 */}
        <div style={{ flexShrink: 0 }}>
          <img src={about1} alt="Community" style={{ width: "300px", height: "auto", borderRadius: "10px" }} />
        </div>
      </div>

      {/* Our Vision Section */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", marginTop: "30px" }}>
        {/* Left Side: Our Vision Content */}
        <div style={{ flex: 1, textAlign: "justify" }}>
        <h2 style={{ fontSize: "22px", fontWeight: "bold", textAlign: "center", marginBottom: "20px", marginTop: "40px" }}>Our Vision</h2>
          <p style={{ fontSize: "16px", color: "#555" }}>
            हम, खटीक समुदाय के रूप में, एकता, सहयोग और सामूहिक प्रयासों के माध्यम से समाज को सशक्त बनाने के लिए प्रतिबद्ध हैं।
            हमारा उद्देश्य है कि हर सदस्य एक-दूसरे से जुड़ा रहे, मिलकर प्रगति करे और आने वाली पीढ़ियों के लिए एक उज्जवल भविष्य का निर्माण करे।
          </p>
          <p style={{ fontSize: "16px", color: "#555" }}>
            हमारी यह पहल आधुनिक तकनीक—मोबाइल एप्लिकेशन, वेबसाइट और अन्य डिजिटल साधनों—के माध्यम से समुदाय को एकजुट करने पर केंद्रित है।
          </p>
          <p style={{ fontSize: "16px", color: "#555", fontWeight: "bold", textAlign: "center" }}>
            सशक्त समाज, उज्जवल भविष्य!
          </p>
        </div>

        {/* Right Side: Image 2 */}
        <div style={{ flexShrink: 0 }}>
          <img src={about2} alt="Vision" style={{ width: "300px", height: "auto", borderRadius: "10px" }} />
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default About;
