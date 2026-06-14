import React from 'react';

const FLASH_CONFIG = {
  four: { label: 'FOUR!', className: 'is-four' },
  six: { label: 'SIX!', className: 'is-six' },
  wicket: { label: 'OUT!', className: 'is-wicket' },
  wide: { label: 'WIDE', className: 'is-wide' },
  noBall: { label: 'NO BALL', className: 'is-no-ball' },
  duck: { label: 'DUCK!', className: 'is-duck' },
};

const DeliveryFlash = ({ type }) => {
  if (!type || !FLASH_CONFIG[type]) return null;
  const config = FLASH_CONFIG[type];

  return (
    <div className={`box-cricket-delivery-flash ${config.className}`} aria-hidden>
      <div className="box-cricket-delivery-flash-ring" />
      {type === 'duck' && (
        <span className="box-cricket-duck-sprite" role="presentation">🦆</span>
      )}
      <span className="box-cricket-delivery-flash-label">{config.label}</span>
    </div>
  );
};

export default DeliveryFlash;
