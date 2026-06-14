import React from 'react';

const BadmintonLoader = ({ label = 'Loading tournament...' }) => (
  <div className="badminton-loader-wrap">
    <div className="badminton-loader-card">
      <div className="court-loader" aria-hidden="true">
        <div className="court-loader-inner">
          <span className="court-line court-outline" />
          <span className="court-line court-center-line" />
          <span className="court-line court-service-left" />
          <span className="court-line court-service-right" />
          <span className="court-net" />
          <span className="court-shuttle">🏸</span>
        </div>
      </div>
      <p className="badminton-loader-text">{label}</p>
    </div>
  </div>
);

export default BadmintonLoader;
