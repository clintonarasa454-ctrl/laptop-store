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
import { payments } from "../drizzle/schema";

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
        const orderId = parseInt(orderIdStr, 10);
        await updatePaymentStatus(orderId, "completed", paymentIntent.id, { provider: "stripe", raw: paymentIntent });
        await updateOrderStatus(orderId, "payment_confirmed", "Payment automatically confirmed via Stripe Webhook", {
          paymentStatus: "paid",
          paymentReference: paymentIntent.id,
        });
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderIdStr = paymentIntent.metadata?.orderId;
      if (orderIdStr) {
        const orderId = parseInt(orderIdStr, 10);
        await updatePaymentStatus(orderId, "failed", paymentIntent.id, { provider: "stripe", raw: paymentIntent });
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
    if (payment.status === "completed") return res.json({ ResultCode: 0, ResultDesc: "Already processed" });

    if (resultCode === 0) {
      const mpesaReceipt = stkCallback.CallbackMetadata?.Item?.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value;
      
      await updatePaymentStatus(orderId, "completed", checkoutRequestId, { provider: "mpesa", receipt: mpesaReceipt, raw: stkCallback });
      await updateOrderStatus(orderId, "payment_confirmed", `M-Pesa payment confirmed (Receipt: ${mpesaReceipt})`, {
        paymentStatus: "paid", paymentReference: mpesaReceipt || checkoutRequestId,
      });

      const order = await getOrderById(orderId);
      if (order) {
        const items = await getOrderItems(order.id);
        for (const item of items) { await updateProductStock(item.productId, -item.quantity); }
        await clearCart(order.userId);
      }
    } else {
      await updatePaymentStatus(orderId, "failed", checkoutRequestId, { provider: "mpesa", raw: stkCallback });
    }

    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err: any) {
    console.error("❌ M-Pesa webhook error:", err.message);
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
           // Check if already completed by the frontend to avoid duplicate stock deductions
           const [payment] = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
           if (payment && payment.status === "completed") {
             return res.json({ received: true, status: "already_processed" });
           }
        }

        await updatePaymentStatus(orderId, "completed", captureId, { provider: "paypal", raw: event });
        await updateOrderStatus(orderId, "payment_confirmed", "PayPal payment confirmed via Webhook", {
          paymentStatus: "paid",
          paymentReference: captureId,
        });

        const order = await getOrderById(orderId);
        if (order) {
          const items = await getOrderItems(order.id);
          for (const item of items) { await updateProductStock(item.productId, -item.quantity); }
          await clearCart(order.userId);
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