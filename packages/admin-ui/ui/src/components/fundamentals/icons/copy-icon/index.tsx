import React from "react"
import IconProps from "../types/icon-type"

const CopyIcon: React.FC<IconProps> = ({
  size = "24",
  color = "currentColor",
  ...attributes
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M19.4 20H9.6C9.44087 20 9.28826 19.9368 9.17574 19.8243C9.06321 19.7117 9 19.5591 9 19.4V9.6C9 9.44087 9.06321 9.28826 9.17574 9.17574C9.28826 9.06321 9.44087 9 9.6 9H19.4C19.5591 9 19.7117 9.06321 19.8243 9.17574C19.9368 9.28826 20 9.44087 20 9.6V19.4C20 19.5591 19.9368 19.7117 19.8243 19.8243C19.7117 19.9368 19.5591 20 19.4 20Z"
        stroke="black"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 9V4.6C15 4.44087 14.9368 4.28826 14.8243 4.17574C14.7117 4.06321 14.5591 4 14.4 4H4.6C4.44087 4 4.28826 4.06321 4.17574 4.17574C4.06321 4.28826 4 4.44087 4 4.6V14.4C4 14.5591 4.06321 14.7117 4.17574 14.8243C4.28826 14.9368 4.44087 15 4.6 15H9"
        stroke="black"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default CopyIcon
