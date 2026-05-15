/**
 * Secure password hashing utility using async scrypt
 * Prevents event loop blocking that occurs with scryptSync
 * 
 * ✅ FIX #4: Replace synchronous scryptSync with async scrypt
 * This prevents Denial of Service attacks by not blocking the event loop
 */

import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Configuration
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const PEPPER = process.env.PASSWORD_PEPPER || ""; // Optional: add to env for extra security

/**
 * Hash a password using async scrypt
 * Non-blocking and suitable for production
 * 
 * @param password - The password to hash
 * @returns Promise<string> - The combined salt:hash in hex format
 * @throws Error if password hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length === 0) {
    throw new Error("Password cannot be empty");
  }

  try {
    const salt = randomBytes(SALT_LENGTH).toString("hex");
    const passwordWithPepper = password + PEPPER;
    const derivedKey = await scryptAsync(
      passwordWithPepper,
      salt,
      KEY_LENGTH
    );
    
    return `${salt}:${(derivedKey as Buffer).toString("hex")}`;
  } catch (error) {
    throw new Error(`Password hashing failed: ${(error as Error).message}`);
  }
}

/**
 * Verify a password against a stored hash
 * Uses timing-safe comparison to prevent timing attacks
 * 
 * @param password - The password to verify
 * @param storedHash - The stored hash in hex format
 * @param salt - The stored salt in hex format
 * @returns Promise<boolean> - True if password matches
 * @throws Error if verification fails
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  if (!password || !storedHash || !salt) {
    return false;
  }

  try {
    const passwordWithPepper = password + PEPPER;
    const derivedKey = await scryptAsync(
      passwordWithPepper,
      salt,
      KEY_LENGTH
    );

    const derivedKeyBuffer = derivedKey as Buffer;
    const storedHashBuffer = Buffer.from(storedHash, "hex");

    // Use timing-safe comparison to prevent timing attacks
    return timingSafeEqual(derivedKeyBuffer, storedHashBuffer);
  } catch (error) {
    // If timing-safe comparison fails due to length mismatch, return false
    if ((error as Error).message.includes("buffers must have equal length")) {
      return false;
    }
    throw new Error(`Password verification failed: ${(error as Error).message}`);
  }
}
