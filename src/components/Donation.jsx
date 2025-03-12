import React, { useState } from 'react';
import donateImage from "./donate.png";


const DonateComponent = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Bank details
  const bankDetails = {
    bankName: "Example Bank",
    ifscCode: "EXBK0001234",
    accountNumber: "1234567890123456"
  };
  
  return (
    <div style={{ textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
      {/* Main image */}
      <div style={{ 
        width: '250px', 
        height: '250px', 
        margin: '0 auto', 
        marginBottom: '20px',
        border: '1px solid #ccc'
      }}>
        <img 
         src={donateImage} 
          alt="Donation campaign" 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      
      {/* Donate button */}
      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          padding: '10px 30px',
          backgroundColor: '#0066cc',
          color: 'white',
          fontWeight: 'bold',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        Donate
      </button>
      
      {/* Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '350px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Donation Details</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ 
                  border: '1px solid #ccc', 
                  background: 'white', 
                  width: '30px', 
                  height: '30px',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              >
                ✕
              </button>
            </div>
            
            {/* QR Code */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <img 
                src="/api/placeholder/200/200" 
                alt="Payment QR Code" 
                style={{ 
                  width: '200px', 
                  height: '200px', 
                  border: '1px solid #ddd',
                  padding: '10px' 
                }}
              />
            </div>
            
            {/* Bank details */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontWeight: 'bold' }}>Bank Name</div>
                <div>{bankDetails.bankName}</div>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontWeight: 'bold' }}>IFSC Code</div>
                <div>{bankDetails.ifscCode}</div>
              </div>
              <div>
                <div style={{ fontWeight: 'bold' }}>Account Number</div>
                <div>{bankDetails.accountNumber}</div>
              </div>
            </div>
            
            <button
              onClick={() => setIsModalOpen(false)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#333',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DonateComponent;