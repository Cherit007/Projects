import React, { useEffect, useState } from "react";
import { account } from "../appwriteConfig"; // Import Appwrite Auth
import { useNavigate } from "react-router-dom";
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
        // Check if the user has the "admin" role
        if (user.labels.includes("admin")) {
          setIsAuthenticated(true);
        } else {
          // Log out if the user does not have the "admin" role
          await account.deleteSession("current");
          navigate("/admin/login");
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        // Redirect to login if the user is not authenticated
        navigate("/admin/login");
      } finally {
        setIsLoading(false);
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
