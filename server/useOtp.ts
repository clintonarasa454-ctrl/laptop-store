import { useState } from "react";

export function useOtp(length = 6) {
  const [otp, setOtp] = useState("");

  const handleChange = (value: string) => {
    setOtp(value.replace(/\D/g, "").slice(0, length));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);
    setOtp(paste);
  };

  return {
    otp,
    setOtp,
    handleChange,
    handlePaste,
  };
}