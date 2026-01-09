import { keyframes } from "@emotion/react";

export const pulseSweep = keyframes`
  0% { transform: translateX(-100%); }
  50% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
`;

