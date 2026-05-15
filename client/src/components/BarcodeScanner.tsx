/**
 * BarcodeScanner Component
 * Provides QR/barcode scanning functionality using html5-qrcode
 * Scans product codes and pre-fills SKU fields in product forms
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { X, Camera, Loader2, AlertCircle } from "lucide-react";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

// Dynamically import html5-qrcode to avoid SSR issues
let Html5QrcodeScanner: any = null;

export default function BarcodeScanner({
  isOpen,
  onClose,
  onScan,
  title = "Scan Product Barcode/QR Code",
}: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const scannerInstanceRef = useRef<any>(null);

  // Initialize the scanner
  useEffect(() => {
    if (!isOpen) return;

    const initScanner = async () => {
      try {
        setError(null);
        setScanning(true);

        // Dynamically import html5-qrcode
        if (!Html5QrcodeScanner) {
          const { Html5QrcodeScanner: Scanner } = await import("html5-qrcode");
          Html5QrcodeScanner = Scanner;
        }

        if (scannerRef.current && !scannerInstanceRef.current) {
          const scanner = new Html5QrcodeScanner(
            scannerRef.current.id,
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1,
            },
            false
          );

          scanner.render(
            (decodedText: string) => {
              // Successfully scanned a code
              onScan(decodedText.trim());
              setManualCode("");
              // Don't close automatically, let user scan more or close manually
              stopScanner();
            },
            (error: any) => {
              // Scanning error (normal during scanning attempts)
              // Don't show this to user, it's just part of scanning
            }
          );

          scannerInstanceRef.current = scanner;
        }
      } catch (err: any) {
        setError(
          err.message ||
          "Failed to initialize scanner. Please check camera permissions."
        );
        setScanning(false);
      }
    };

    initScanner();

    return () => {
      stopScanner();
    };
  }, [isOpen, onScan]);

  const stopScanner = async () => {
    if (scannerInstanceRef.current) {
      try {
        await scannerInstanceRef.current.clear();
        scannerInstanceRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setScanning(false);
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode("");
      stopScanner();
    }
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[var(--brand)]" />
              <h3 className="text-lg font-bold">{title}</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Scanner Container */}
          {error ? (
            <div className="bg-destructive/10 border border-destructive text-destructive rounded-lg p-4 space-y-2">
              <div className="flex gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Scanner Error</p>
                  <p className="text-xs mt-1">{error}</p>
                </div>
              </div>
              <p className="text-xs text-destructive/80">
                💡 Tip: Make sure you've granted camera permissions and that no other app is using the camera.
              </p>
            </div>
          ) : (
          <div className="relative bg-black rounded-lg overflow-hidden aspect-square flex items-center justify-center">
            {/* The scanner library will mutate this specific div. Keep it empty of React children! */}
            <div id="scanner-container" ref={scannerRef} className="absolute inset-0 w-full h-full"></div>
            
              {!scanning && (
              <div className="text-white text-center space-y-2 absolute z-10 pointer-events-none">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                  <p className="text-sm">Initializing camera...</p>
                </div>
              )}
            </div>
          )}

          {/* Manual Entry Alternative */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Or enter manually:
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. SKU123456"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleManualSubmit();
                  }
                }}
              />
              <Button
                onClick={handleManualSubmit}
                disabled={!manualCode.trim()}
                className="bg-[var(--brand)] text-white hover:opacity-90"
              >
                Add
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How to use:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Point camera at barcode or QR code</li>
              <li>Scanner will auto-detect and process</li>
              <li>Or manually type the code above</li>
            </ul>
          </div>

          {/* Close Button */}
          <Button variant="outline" onClick={handleClose} className="w-full">
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}
