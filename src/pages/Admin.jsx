import React from "react";
import { Navigate, Outlet } from "react-router-dom";
export default function Admin() {
    return (
      <div className="admin-dashboard">
        <Outlet />
      </div>
    );
}
