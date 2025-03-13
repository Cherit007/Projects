import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    // Hardcoded admin credentials for demonstration
    if (username === "admin" && password === "admin123") {
      sessionStorage.setItem("isAuthenticated", "true"); // Store authentication status
      navigate("/admin/dashboard"); // Redirect to admin dashboard
    } else {
      setError("Invalid username or password");
    }
  };

  return (
    <div className="login-container">
      <h2>Admin Login</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Username:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="submit-button">
          Login
        </button>
      </form>
    </div>
  );
};

export default Login;


// import React from "react";
// import { account } from "../appwriteConfig"; // Import Appwrite Auth
// import { useNavigate } from "react-router-dom";

// const Login = () => {
//   const navigate = useNavigate();

//   // Handle Google OAuth login
//   const handleLogin = async () => {
//     try {
//       // Redirect to Google OAuth login
//       await account.createOAuth2Session(
//         "google", // Provider (Google)
//         "http://localhost:3000/admin/dashboard", // Success URL
//         "http://localhost:3000/login" // Failure URL
//       );
//     } catch (error) {
//       console.error("Error during login:", error);
//     }
//   };

//   return (
//     <div className="login-page">
//       <h1>Admin Login</h1>
//       <button onClick={handleLogin} className="login-button">
//         Login with Google
//       </button>
//     </div>
//   );
// };

// export default Login;