import React, { forwardRef } from 'react';
import Webcam from 'react-webcam';

const WebcamBox = forwardRef(({ width = 400 }, ref) => {
  return (
    <Webcam
      ref={ref}
      audio={false}
      mirrored={true}
      screenshotFormat="image/jpeg"
      videoConstraints={{ facingMode: 'user' }}
      style={{ borderRadius: 10, width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
});

export default WebcamBox;
