import { useEffect } from "react";
import { useLocation } from "wouter";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Verification has moved directly into the Auth page via 6-digit OTP code.
    setLocation("/auth");
  }, [setLocation]);

  return null;
}