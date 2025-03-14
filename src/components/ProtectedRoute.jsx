import React, { useEffect, useState } from "react";
import { account } from "../appwriteConfig"; // Import Appwrite Auth
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify"; // Import toast
import "react-toastify/dist/ReactToastify.css"; // Import toast CSS
import Loader from "./Loader";

const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Check if the user is authenticated and has the "admin" role
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await account.get();
        console.log("User data:", user); // Debugging: Log user data

        // Check if the user has the "admin" role
        if (user.labels && user.labels.includes("admin")) {
          console.log("User is authenticated and has the 'admin' role.");
          setIsAuthenticated(true); // User is authenticated and has the "admin" role
        } else {
          // Log out if the user does not have the "admin" role
          console.log("User does not have the 'admin' role. Logging out...");
          await account.deleteSession("current");
          toast.error(
            "You do not have permission to access the admin dashboard."
          ); // Toast message
          setTimeout(() => {
            navigate("/admin/login"); // Redirect after toast is shown
          }, 1000); // Delay redirect by 1 second
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        setTimeout(() => {
          navigate("/admin/login"); // Redirect after toast is shown
        }, 1000); // Delay redirect by 1 second
      } finally {
        setIsLoading(false); // Stop loading
      }
    };

    checkAuth();
  }, [navigate]);

  if (isLoading) {
    return <Loader />; // Show a loader while checking auth
  }

  return isAuthenticated ? children : null; // Render nested routes if authenticated
};

export default ProtectedRoute;
