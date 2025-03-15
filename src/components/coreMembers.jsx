import React, { useState, useEffect } from "react";
import { databases } from "../appwriteConfig";
import { Query } from "appwrite";

const CoreCommunityTable = () => {
  const [members, setMembers] = useState([]);
  const [selectedState, setSelectedState] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await databases.listDocuments(
          "67cff2840013b293be3c",
          "67d301a8000b5dd7e089",
          [Query.equal("isCoreMember", true)]
        );
        setMembers(response.documents);
      } catch (error) {
        console.error("Error fetching members:", error);
      }
    };

    fetchMembers();
  }, []);

  const filteredMembers =
    selectedState === "All"
      ? members
      : members.filter((member) => member.stateName === selectedState);

  const totalPages = Math.ceil(filteredMembers.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const displayedMembers = filteredMembers.slice(startIndex, startIndex + rowsPerPage);

  const uniqueStates = ["All", ...new Set(members.map((m) => m.stateName))];

  return (
    <div className="p-4 flex flex-col items-center w-full"  style={{ width: "100%" }}>
      <h2 className="text-xl font-bold mb-4">Core Community Members</h2>
      
      <div className="mb-4 w-full flex justify-center">
        <label className="mr-2">Filter by State:</label>
        <select
          className="border p-2"
          value={selectedState}
          onChange={(e) => {
            setSelectedState(e.target.value);
            setCurrentPage(1);
          }}
        >
          {uniqueStates.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>
      
      <div className="w-full" style={{ width: "100%" }}>
        <div className="overflow-x-auto w-full">
          <table className="table-auto w-full border-collapse border border-gray-300"style={{ width: "100%" }}>
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-300 p-2" style={{ width: "22.5%" }}>Name</th>
                <th className="border border-gray-300 p-2"style={{ width: "22.5%" }}>State</th>
                <th className="border border-gray-300 p-2"style={{ width: "22.5%" }}>Mobile Number</th>
                <th className="border border-gray-300 p-2"style={{ width: "22.5%" }}>Email Address</th>
              </tr>
            </thead>
            <tbody>
              {displayedMembers.map((member) => (
                <tr key={member.$id} className="text-center border border-gray-300">
                  <td className="border border-gray-300 p-2">{member.name}</td>
                  <td className="border border-gray-300 p-2">{member.stateName}</td>
                  <td className="border border-gray-300 p-2">{member.mobileNumber}</td>
                  <td className="border border-gray-300 p-2">{member.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="flex justify-center items-center mt-4 space-x-2">
        <button
          className={`px-3 py-1 border rounded ${currentPage === 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-200"}`}
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        >
          Prev
        </button>
        <span className="px-4">Page {currentPage} of {totalPages}</span>
        <button
          className={`px-3 py-1 border rounded ${currentPage === totalPages ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-200"}`}
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default CoreCommunityTable;
