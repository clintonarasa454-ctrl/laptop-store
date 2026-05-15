/**
 * Storage Configuration Verification
 * Validates that at least one storage backend is properly configured
 */

export interface StorageConfig {
  type: "forge" | "s3" | "none";
  configured: boolean;
  warning?: string;
}

/**
 * Checks which storage backends are configured
 */
export function checkStorageConfiguration(): StorageConfig {
  // Check Forge/Manus configuration
  const hasForgeUrl = process.env.BUILT_IN_FORGE_API_URL?.trim();
  const hasForgeKey = process.env.BUILT_IN_FORGE_API_KEY?.trim();

  if (hasForgeUrl && hasForgeKey) {
    // Validate URL format
    try {
      new URL(hasForgeUrl);
      return {
        type: "forge",
        configured: true,
      };
    } catch {
      return {
        type: "forge",
        configured: false,
        warning: `Invalid BUILT_IN_FORGE_API_URL: "${hasForgeUrl}". Expected a valid URL.`,
      };
    }
  }

  // Check AWS S3 configuration
  const hasS3Key = process.env.AWS_ACCESS_KEY_ID?.trim();
  const hasS3Secret = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const hasS3Bucket = process.env.AWS_S3_BUCKET?.trim();

  if (hasS3Key && hasS3Secret && hasS3Bucket) {
    return {
      type: "s3",
      configured: true,
    };
  } else if (hasS3Key || hasS3Secret || hasS3Bucket) {
    // Partial S3 configuration
    const missing = [];
    if (!hasS3Key) missing.push("AWS_ACCESS_KEY_ID");
    if (!hasS3Secret) missing.push("AWS_SECRET_ACCESS_KEY");
    if (!hasS3Bucket) missing.push("AWS_S3_BUCKET");

    return {
      type: "s3",
      configured: false,
      warning: `AWS S3 partially configured. Missing: ${missing.join(", ")}`,
    };
  }

  return {
    type: "none",
    configured: false,
    warning: "No storage backend configured. Image uploads will fail.",
  };
}

/**
 * Verifies that a key file/folder is accessible (for mounted storage)
 */
export async function verifyStorageAccess(path: string): Promise<boolean> {
  try {
    // This is a placeholder for actual storage verification
    // In production, you might test connectivity to S3 or Forge
    return true;
  } catch {
    return false;
  }
}
