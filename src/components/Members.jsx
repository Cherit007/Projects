import React, { useState } from "react";

const membersData = [
  {
    id: 1,
    photo: "https://via.placeholder.com/50",
    name: "John Doe",
    state: "California",
    mobile: "123-456-7890",
    email: "johndoe@example.com",
  },
  {
    id: 2,
    photo: "https://via.placeholder.com/50",
    name: "Jane Smith",
    state: "Texas",
    mobile: "987-654-3210",
    email: "janesmith@example.com",
  },
  {
    id: 3,
    photo: "https://via.placeholder.com/50",
    name: "Alice Johnson",
    state: "California",
    mobile: "555-123-4567",
    email: "alicej@example.com",
  },
  // Add more members as needed
];

const CommunityTable = () => {
  const [selectedState, setSelectedState] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;

  const filteredMembers =
    selectedState === "All"
      ? membersData
      : membersData.filter((member) => member.state === selectedState);

  const totalPages = Math.ceil(filteredMembers.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const displayedMembers = filteredMembers.slice(startIndex, startIndex + rowsPerPage);
  
  const uniqueStates = ["All", ...new Set(membersData.map((m) => m.state))];

  return (
    <div className="p-4 flex flex-col items-center w-full" style={{ width: "100%" }}>
      <h2 className="text-xl font-bold mb-4">Community Members</h2>
      
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
          <table className="table-auto w-full border-collapse border border-gray-300" style={{ width: "100%" }}>
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-300 p-2" style={{ width: "10%" }}>Photo</th>
                <th className="border border-gray-300 p-2" style={{ width: "22.5%" }}>Name</th>
                <th className="border border-gray-300 p-2" style={{ width: "22.5%" }}>State</th>
                <th className="border border-gray-300 p-2" style={{ width: "22.5%" }}>Mobile Number</th>
                <th className="border border-gray-300 p-2" style={{ width: "22.5%" }}>Email Address</th>
              </tr>
            </thead>
            <tbody>
              {displayedMembers.map((member) => (
                <tr key={member.id} className="text-center border border-gray-300">
                  <td className="border border-gray-300 p-2">
                    <img src={member.photo} alt={member.name} className="w-10 h-10 rounded-full mx-auto" />
                  </td>
                  <td className="border border-gray-300 p-2">{member.name}</td>
                  <td className="border border-gray-300 p-2">{member.state}</td>
                  <td className="border border-gray-300 p-2">{member.mobile}</td>
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

export default CommunityTable;