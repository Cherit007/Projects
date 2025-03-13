import React from "react";
import { useNavigate } from "react-router-dom";
import { account } from "../appwriteConfig";
import { toast, ToastContainer } from "react-toastify"; // Import toast and ToastContainer
import "react-toastify/dist/ReactToastify.css"; // Import toast CSS
import "../index.css"; // Import the CSS file

const Login = () => {
  const navigate = useNavigate();

  // Handle Google OAuth login
  const handleLogin = async () => {
    try {
      // Redirect to Google OAuth login
      await account.createOAuth2Session(
        "google", // Provider (Google)
        "http://localhost:5173/admin/dashboard", // Success URL
        "http://localhost:5173/admin/login" // Failure URL
      );
      // Show success toast
    } catch (error) {
      console.error("Error during login:", error);
      // Show error toast
      toast.error("Failed to log in. Please try again.");
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Welcome Back!</h1>
        <p>Please log in to access the admin dashboard.</p>
        <button onClick={handleLogin} className="login-button">
          <img
            src="https://yt3.googleusercontent.com/K8WVrQAQHTTwsHEtisMYcNai7p7XIlyEAdZg86qYw78ye57r5DRemHQ9Te4PcD_v98HB-ZvQjQ=s900-c-k-c0x00ffffff-no-rj"
            alt="Google Logo"
            className="google-logo"
          />
          Continue with Google
        </button>
      </div>
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
    </div>
  );
};

export default Login;