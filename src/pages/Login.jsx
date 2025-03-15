import React from "react";
import { useNavigate } from "react-router-dom";
import { account } from "../appwriteConfig";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../index.css";

const Login = () => {
  const navigate = useNavigate();

  // Handle Google OAuth login
  const handleLogin = async () => {
    try {
      console.log("Redirecting to Google OAuth...");
      await account.createOAuth2Session(
        "google", // Provider (Google)
        import.meta.env.VITE_LOGIN_SUCCESS_URL, // Success URL
        import.meta.env.VITE_LOGIN_FAILURE_URL // Failure URL
      );

      // After OAuth flow completes, check the user's role
      const user = await account.get();
      console.log("User data after login:", user);

      if (user.labels && user.labels.includes("admin")) {
        console.log("User has the 'admin' role. Allowing access.");
        navigate("/admin/dashboard"); // Redirect to dashboard
      } else {
        console.log("User does not have the 'admin' role. Deleting session...");
        await account.deleteSession("current"); // Delete the session
        navigate("/admin/login"); // Redirect back to login
      }
    } catch (error) {
      console.error("Error during login:", error);
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
      {/* <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      /> */}
    </div>
  );
};

export default Login;