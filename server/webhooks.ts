import express from "express";
import Stripe from "stripe";
import { 
  getSetting, 
  updatePaymentStatus, 
  updateOrderStatus, 
  getOrderById, 
  getOrderItems, 
  updateProductStock, 
  clearCart,
  getDb
} from "./db";
import { eq } from "drizzle-orm";
import { payments, deliveryPayouts } from "../drizzle/schema";
import { createHmac } from "crypto";

export const webhookRouter = express.Router();

// We use express.raw() here because Stripe requires the raw buffer to verify the signature
webhookRouter.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.warn("⚠️ Webhook skipped: Missing stripe signature or STRIPE_WEBHOOK_SECRET env variable");
    return res.status(400).send("Webhook secret/signature missing");
  }

  try {
    const paymentSettings = await getSetting("payment");
    if (!paymentSettings?.stripeSecret) return res.status(400).send("Stripe not configured");
    
    const stripe = new Stripe(paymentSettings.stripeSecret, { apiVersion: "2023-10-16" });
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderIdStr = paymentIntent.metadata?.orderId;
      
      if (orderIdStr) {
        try {
          const orderId = parseInt(orderIdStr, 10);
          await updatePaymentStatus(orderId, "paid", paymentIntent.id, { provider: "stripe", raw: paymentIntent });
          await updateOrderStatus(orderId, "payment_confirmed", "Payment automatically confirmed via Stripe Webhook", {
            paymentStatus: "paid",
            paymentReference: paymentIntent.id,
          });
          console.log(`✅ Stripe webhook: Order ${orderId} payment confirmed`);
        } catch (orderError: any) {
          console.error(`❌ Stripe webhook: Failed to process order ${orderIdStr}:`, orderError.message);
        }
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderIdStr = paymentIntent.metadata?.orderId;
      if (orderIdStr) {
        try {
          const orderId = parseInt(orderIdStr, 10);
          await updatePaymentStatus(orderId, "failed", paymentIntent.id, { provider: "stripe", raw: paymentIntent });
          console.warn(`⚠️ Stripe webhook: Order ${orderId} payment failed`);
        } catch (orderError: any) {
          console.error(`❌ Stripe webhook: Failed to log payment failure for ${orderIdStr}:`, orderError.message);
        }
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("❌ Stripe webhook error:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// M-Pesa uses standard JSON, so we can parse it directly on this route
webhookRouter.post("/mpesa", express.json(), async (req, res) => {
  try {
    // ────── SECURITY: Validate M-Pesa webhook signature ──────────────────
    // M-Pesa sends an Authorization header with HMAC-SHA256 signature
    // This prevents unauthorized parties from triggering payments
    const mpesaSettings = await getSetting("payment");
    const consumerSecret = mpesaSettings?.mpesaConsumerSecret;
    
    if (!consumerSecret) {
      console.warn("⚠️ M-Pesa webhook: Consumer secret not configured");
      return res.status(400).send("M-Pesa not configured");
    }

    // Get the signature from headers (Safaricom sends it in Authorization header)
    // Format: "Safaricom XXX" where XXX is the HMAC-SHA256 hash
    const authHeader = req.headers.authorization || "";
    
    // Compute expected signature using consumer secret
    const rawBody = JSON.stringify(req.body);
    const expectedSignature = createHmac("sha256", consumerSecret)
      .update(rawBody)
      .digest("base64");
    
    // Note: This is a basic check. Safaricom's actual implementation may vary.
    // If Safaricom uses a different signing method, adjust accordingly.
    if (!authHeader || !authHeader.includes(expectedSignature)) {
      console.warn("⚠️ M-Pesa webhook: Signature mismatch. Rejecting unauthorized attempt.");
      return res.status(401).send("Unauthorized");
    }

    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback) return res.status(400).send("Invalid payload");

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;

    if (!checkoutRequestId) return res.status(400).send("Missing CheckoutRequestID");

    const db = await getDb();
    if (!db) return res.status(500).send("Database Error");

    // Find the payment record using the CheckoutRequestID we saved earlier
    const [payment] = await db.select().from(payments).where(eq(payments.transactionId, checkoutRequestId)).limit(1);

    if (!payment) {
      console.warn(`⚠️ M-Pesa Webhook: Payment not found for CheckoutRequestID: ${checkoutRequestId}`);
      return res.json({ ResultCode: 0, ResultDesc: "Accepted but not found" }); // Still return 0 to acknowledge Safaricom
    }

    const orderId = payment.orderId;
    if (payment.status === "paid") return res.json({ ResultCode: 0, ResultDesc: "Already processed" });

    if (resultCode === 0) {
      try {
        const mpesaReceipt = stkCallback.CallbackMetadata?.Item?.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value;
        
        await updatePaymentStatus(orderId, "paid", checkoutRequestId, { provider: "mpesa", receipt: mpesaReceipt, raw: stkCallback });
        await updateOrderStatus(orderId, "payment_confirmed", `M-Pesa payment confirmed (Receipt: ${mpesaReceipt})`, {
          paymentStatus: "paid", paymentReference: mpesaReceipt || checkoutRequestId,
        });

        const order = await getOrderById(orderId);
        if (order) {
          try {
            const items = await getOrderItems(order.id);
            for (const item of items) { 
                  await updateProductStock(item.productId, -item.quantity, order.id);
            }
            if (order.userId) await clearCart(order.userId);
            console.log(`✅ M-Pesa webhook: Order ${orderId} completed with stock updated`);
          } catch (stockError: any) {
            console.error(`⚠️ M-Pesa webhook: Stock update failed for order ${orderId}:`, stockError.message);
          }
        }
      } catch (processError: any) {
        console.error(`❌ M-Pesa webhook: Payment processing error for ${checkoutRequestId}:`, processError.message);
      }
    } else {
      try {
        await updatePaymentStatus(orderId, "failed", checkoutRequestId, { provider: "mpesa", raw: stkCallback });
        console.warn(`⚠️ M-Pesa webhook: Order ${orderId} payment failed with code ${resultCode}`);
      } catch (failureError: any) {
        console.error(`❌ M-Pesa webhook: Failed to log payment failure:`, failureError.message);
      }
    }

    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err: any) {
    console.error("❌ M-Pesa webhook error:", err.message);
    res.status(500).send("Webhook Error");
  }
});

// M-Pesa B2C Payout Webhooks
webhookRouter.post("/mpesa/b2c/result", express.json(), async (req, res) => {
  try {
    const { Result } = req.body;
    if (!Result || !Result.OriginatorConversationID) return res.status(400).send("Invalid payload");
    
    const db = await getDb();
    if (!db) return res.status(500).send("Database Error");

    if (Result.ResultCode === 0) {
      await db.update(deliveryPayouts)
        .set({ status: 'completed', processedAt: new Date(), transactionId: Result.TransactionID })
        .where(eq(deliveryPayouts.mpesaOriginatorConversationId, Result.OriginatorConversationID));
    } else {
      await db.update(deliveryPayouts)
        .set({ status: 'failed', processedAt: new Date(), notes: Result.ResultDesc })
        .where(eq(deliveryPayouts.mpesaOriginatorConversationId, Result.OriginatorConversationID));
    }
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err: any) {
    console.error("❌ M-Pesa B2C Result webhook error:", err.message);
    res.status(500).send("Webhook Error");
  }
});

webhookRouter.post("/mpesa/b2c/timeout", express.json(), async (req, res) => {
  try {
    const { Result } = req.body;
    const db = await getDb();
    if (db && Result?.OriginatorConversationID) {
      await db.update(deliveryPayouts).set({ status: 'failed', notes: 'M-Pesa API request timed out.' }).where(eq(deliveryPayouts.mpesaOriginatorConversationId, Result.OriginatorConversationID));
    }
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err: any) {
    console.error("❌ M-Pesa B2C Timeout webhook error:", err.message);
    res.status(500).send("Webhook Error");
  }
});

// PayPal Webhook
webhookRouter.post("/paypal", express.json(), async (req, res) => {
  try {
    const event = req.body;
    if (!event || !event.event_type) return res.status(400).send("Invalid payload");

    // We specifically listen for completed captures
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const resource = event.resource;
      const orderIdStr = resource?.custom_id;
      const captureId = resource?.id;

      if (orderIdStr) {
        const orderId = parseInt(orderIdStr, 10);
        
        const db = await getDb();
        if (db) {
           // ✅ FIXED: Check if already completed by front-end to avoid duplicate stock deductions
           const [payment] = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
       if (payment && payment.status === "paid") {
             console.log(`ℹ️ PayPal webhook: Order ${orderId} already processed, skipping`);
             return res.json({ received: true, status: "already_processed" });
           }
        }

        try {
          await updatePaymentStatus(orderId, "paid", captureId, { provider: "paypal", raw: event });
          await updateOrderStatus(orderId, "payment_confirmed", "PayPal payment confirmed via Webhook", {
            paymentStatus: "paid",
            paymentReference: captureId,
          });

          const order = await getOrderById(orderId);
          if (order) {
            try {
              const items = await getOrderItems(order.id);
              for (const item of items) { 
                  await updateProductStock(item.productId, -item.quantity, order.id);
              }
              if (order.userId) await clearCart(order.userId);
              console.log(`✅ PayPal webhook: Order ${orderId} completed with stock updated`);
            } catch (stockError: any) {
              console.error(`⚠️ PayPal webhook: Stock update failed for order ${orderId}:`, stockError.message);
            }
          }
        } catch (processError: any) {
          console.error(`❌ PayPal webhook: Payment processing error:`, processError.message);
        }
      }
    } else if (event.event_type === "PAYMENT.CAPTURE.DENIED") {
      const resource = event.resource;
      const orderIdStr = resource?.custom_id;
      if (orderIdStr) {
        const orderId = parseInt(orderIdStr, 10);
        await updatePaymentStatus(orderId, "failed", resource?.id, { provider: "paypal", raw: event });
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("❌ PayPal webhook error:", err.message);
    res.status(500).send("Webhook Error");
  }
});