import React from "react";
import { Navigate, Outlet } from "react-router-dom";
export default function Admin() {
    const isAuthenticated = sessionStorage.getItem("isAuthenticated");

    if (!isAuthenticated) {
      return <Navigate to="/admin/login" />;
    }
  
    return (
      <div className="admin-dashboard">
        <Outlet />
      </div>
    );
}
