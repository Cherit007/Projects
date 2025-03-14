import React, { useState, useEffect } from "react";
import { Databases } from "appwrite";
import { client } from "../appwriteConfig";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Loader from "../components/Loader";

const RegistrationRequests = () => {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isRejected, setIsRejected] = useState(false);

  // Initialize Appwrite Database
  const databases = new Databases(client);

  // Fetch registration requests
  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const response = await databases.listDocuments(
        "67cff2840013b293be3c", // Replace with your database ID
        "67d301a8000b5dd7e089" // Replace with your collection ID
      );
      setRequests(response.documents);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("Failed to fetch registration requests. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Approve a registration request
  const approveRequest = async (requestId) => {
    try {
      setIsApproved(true);
      await databases.updateDocument(
        "67cff2840013b293be3c", // Replace with your database ID
        "67d301a8000b5dd7e089", // Replace with your collection ID
        requestId,
        { status: "approved" }
      );
      toast.success("Registration request approved!");
      fetchRequests(); // Refresh the list
      setIsApproved(false);
    } catch (error) {
      console.error("Error approving request:", error);
      toast.error("Failed to approve request. Please try again.");
    }
  };

  // Reject a registration request
  const rejectRequest = async (requestId) => {
    try {
      setIsRejected(true);
      await databases.updateDocument(
        "67cff2840013b293be3c", // Replace with your database ID
        "67d301a8000b5dd7e089", // Replace with your collection ID
        requestId,
        { status: "rejected" }
      );
      toast.success("Registration request rejected!");
      fetchRequests(); // Refresh the list
      setIsRejected(false);
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error("Failed to reject request. Please try again.");
    }
  };

  // Toggle core committee status
  const toggleCoreCommittee = async (requestId, currentStatus) => {
    try {

      await databases.updateDocument(
        "67cff2840013b293be3c", // Replace with your database ID
        "67d301a8000b5dd7e089", // Replace with your collection ID
        requestId,
        { isCoreMember: !currentStatus }
      );
      toast.success("Core committee status updated!");
      fetchRequests(); // Refresh the list
    } catch (error) {
      console.error("Error updating core committee status:", error);
      toast.error("Failed to update core committee status. Please try again.");
    }
  };

  // Fetch requests on component mount
  useEffect(() => {
    fetchRequests();
  }, []);

  return (
    <div className="registration-requests">
      <h2>Registration Requests</h2>
      {isLoading ? (
        <Loader />
      ) : (
        <table className="requests-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Core Committee</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.$id}>
                <td>{request.name}</td>
                <td>{request.email}</td>
                <td>{request.status}</td>
                <td>
                  <button
                    className={`toggle-button ${
                      request.isCoreMember ? "active" : ""
                    }`}
                    onClick={() =>
                      toggleCoreCommittee(request.$id, request.isCoreMember)
                    }
                  >
                    {request.isCoreMember ? "Remove from Core" : "Add to Core"}
                  </button>
                </td>
                <td>
                  {request.status === "pending" && (
                    <>
                      <button
                        className="approve-button"
                        onClick={() => approveRequest(request.$id)}
                      >
                        {isApproved ? (
                          <div className="spinner"></div>
                        ) : (
                          "Approve"
                        )}
                      </button>
                      <button
                        className="reject-button"
                        onClick={() => rejectRequest(request.$id)}
                      >
                        {isRejected ? (
                          <div className="spinner"></div>
                        ) : (
                          "Reject"
                        )}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* <ToastContainer /> */}
    </div>
  );
};

export default RegistrationRequests;
