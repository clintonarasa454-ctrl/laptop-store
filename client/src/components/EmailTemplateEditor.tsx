import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { 
  Save, Eye, Code, Mail, Palette, Zap, BookOpen, RotateCcw, 
  Send, Loader2, Maximize2, Minimize2, X, GripVertical, 
  Plus, Trash2, LayoutTemplate, Layers, Image as ImageIcon,
  Smartphone, Monitor, MoveVertical
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface EmailTemplate {
  name: string;
  key: string;
  subject: string;
  body: string;
  description: string;
  variables: string[];
  category?: string;
  designs?: TemplateDesign[];
}

interface TemplateDesign {
  name: string;
  description: string;
  body: string;
  theme: "system" | "modern" | "minimal" | "professional" | "creative";
}

interface VisualBlock {
  id: string;
  type: 'header' | 'text' | 'button' | 'divider' | 'variables' | 'image' | 'spacer';
  content: string;
  color?: string;
  fontFamily?: string;
}

const systemBaseTemplate = (title: string, content: string) => `
<div style="font-family: system-ui, -apple-system, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); background-color: {{emailBackgroundColor}};">
  <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: #111; text-align: center;">{{storeName}}</h2>
    <h1 style="font-size: 24px; margin: 0; color: {{primaryColor}};">${title}</h1>
  </div>
  <div style="font-size: 16px; line-height: 1.6;">
    ${content}
  </div>
  <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
    Need help? Contact us at <a href="mailto:{{contactEmail}}" style="color: {{primaryColor}}; text-decoration: none;">{{contactEmail}}</a>
  </p>
</div>`.trim();

const TEMPLATE_DESIGNS: Record<string, TemplateDesign[]> = {
  orderConfirmation: [
    {
      name: "Store Default",
      description: "The standard system layout used currently",
      theme: "system",
      body: systemBaseTemplate(
        "Order Confirmed!",
        `<p>Hi <strong>{{shippingFullName}}</strong>,</p>
        <p>{{customMessage}}</p>
        <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Order Summary (#{{orderNumber}})</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            {{itemsHtml}}
            <tr><td style="padding: 8px 0; font-weight: 600; padding-top: 12px;">Subtotal</td><td style="padding: 8px 0; text-align: right; font-weight: 600; padding-top: 12px;">{{subtotal}}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: 600;">Shipping</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">{{shippingCost}}</td></tr>
            <tr><td style="padding: 12px 0 0 0; font-size: 16px; font-weight: 700; border-top: 2px solid #e5e7eb;">Total</td><td style="padding: 12px 0 0 0; font-size: 16px; font-weight: 700; text-align: right; border-top: 2px solid #e5e7eb;">{{total}}</td></tr>
          </table>
        </div>
        <div style="text-align: center; margin: 30px 0;"><a href="{{orderLink}}" style="display: inline-block; padding: 12px 24px; background: {{primaryColor}}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Order Details</a></div>`
      )
    },
    {
      name: "Modern Blue",
      description: "Clean, modern design with blue accents",
      theme: "modern",
      body: `<div style="font-family: 'Segoe UI', Tahoma, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 0;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">✓ Order Confirmed!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Thank you for your purchase from {{storeName}}</p>
          </div>
          <div style="padding: 40px;">
            <p style="margin: 0 0 20px 0; font-size: 16px;">Hi <strong>{{shippingFullName}}</strong>,</p>
            <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #666;">Order Number: <strong style="color: #667eea; font-size: 18px;">#{{orderNumber}}</strong></p>
            </div>
            <h3 style="color: #333; margin: 25px 0 15px 0; font-size: 18px;">Order Details:</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
              {{itemsHtml}}
            </table>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
              <tr style="border-bottom: 1px solid #eee;"><td style="padding: 12px 0; color: #666;">Subtotal:</td><td style="padding: 12px 0; text-align: right; font-weight: 600;">{{subtotal}}</td></tr>
              <tr style="border-bottom: 1px solid #eee;"><td style="padding: 12px 0; color: #666;">Shipping:</td><td style="padding: 12px 0; text-align: right; font-weight: 600;">{{shippingCost}}</td></tr>
              <tr style="border-bottom: 1px solid #eee;"><td style="padding: 12px 0; color: #666;">Total Amount:</td><td style="padding: 12px 0; text-align: right; font-weight: 600; font-size: 18px; color: #667eea;">{{total}}</td></tr>
            </table>
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{orderLink}}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Order Details</a>
            </div>
            <p style="margin: 25px 0 0 0; color: #666; font-size: 14px; text-align: center;">We'll send you a shipping notification as soon as your order is on the way! 📦</p>
          </div>
        </div>
      </div>`
    }
  ],
  shipping: [
    {
      name: "Store Default",
      description: "The standard system layout used currently",
      theme: "system",
      body: systemBaseTemplate(
        "Your Order Has Shipped!",
        `<p>Hi <strong>{{shippingFullName}}</strong>,</p>
        <p>{{customMessage}}</p>
        <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0; font-size: 14px; border: 1px solid #e5e7eb;">
          <p style="margin: 0 0 8px 0;"><strong>Order Number:</strong> #{{orderNumber}}</p>
          <p style="margin: 0;"><strong>Shipping To:</strong><br/>{{shippingAddress}}<br/>{{shippingCity}}</p>
        </div>
        {{trackingHtml}}
        <div style="text-align: center; margin: 30px 0;"><a href="{{trackLink}}" style="display: inline-block; padding: 12px 24px; background: {{primaryColor}}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Track Your Order</a></div>`
      )
    },
    {
      name: "Excited",
      description: "Friendly, excited tone with emoji",
      theme: "creative",
      body: `<div style="font-family: 'Segoe UI', sans-serif; background: #fff8f0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; border: 2px solid #ff6b35;">
          <div style="background: linear-gradient(135deg, #ff6b35, #ffa500); color: white; padding: 50px; text-align: center;">
            <h1 style="margin: 0; font-size: 48px;">🚀</h1>
            <h2 style="margin: 15px 0 0 0; font-size: 28px; font-weight: 700;">It's On The Way!</h2>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">Your order from {{storeName}} is headed to you</p>
          </div>
          <div style="padding: 40px;">
            <p style="margin: 0 0 20px 0; font-size: 16px;">Hi <strong>{{shippingFullName}}</strong>,</p>
            <h3 style="color: #ff6b35; margin: 0 0 10px 0; font-size: 20px;">Tracking Details:</h3>
            <div style="background: #fff3e0; border-left: 4px solid #ff6b35; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0; color: #333;"><strong>Order Number:</strong> #{{orderNumber}}</p>
              {{trackingHtml}}
            </div>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 14px; border: 1px solid #e5e7eb;"><p style="margin: 0 0 8px 0;"><strong>Shipping To:</strong><br/>{{shippingAddress}}<br/>{{shippingCity}}</p></div>
            <p style="margin: 20px 0; text-align: center;"><a href="{{trackLink}}" style="display: inline-block; background: #ff6b35; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">Track Your Package 📦</a></p>
            <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6; text-align: center;">Can't wait to see you unbox it! Thank you for shopping with us! 💝</p>
          </div>
        </div>
      </div>`
    }
  ],
  abandonedCart: [
    {
      name: "Store Default",
      description: "The standard system layout used currently",
      theme: "system",
      body: systemBaseTemplate(
        "You left something behind!",
        `<p>Hi <strong>{{shippingFullName}}</strong>,</p>
        <p>We noticed you started an order but haven't completed the payment yet. Your items are currently saved, but they might sell out soon!</p>
        <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Your Cart (#{{orderNumber}})</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            {{itemsHtml}}
            <tr><td colspan="2" style="padding: 12px 0 0 0; font-size: 14px; font-weight: 700; border-top: 2px solid #e5e7eb; text-align: right;">Total: {{total}}</td></tr>
          </table>
        </div>
        <div style="text-align: center; margin: 30px 0;"><a href="{{orderLink}}" style="display: inline-block; padding: 12px 24px; background: {{primaryColor}}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Complete Your Order</a></div>`
      )
    }
  ],
  orderCancelled: [
    {
      name: "Store Default",
      description: "The standard system layout used currently",
      theme: "system",
      body: systemBaseTemplate(
        "Order Cancelled",
        `<p>Hi <strong>{{shippingFullName}}</strong>,</p>
        <p>This email confirms that your order <strong>#{{orderNumber}}</strong> has been successfully cancelled.</p>
        <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0; text-align: center; border: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 14px; color: #4b5563;">If you have already paid, a refund for <strong>{{total}}</strong> will be processed within 3-5 business days.</p>
        </div>
        <p style="font-size: 13px; color: #6b7280;">If you did not request this cancellation, please contact us immediately at <a href="mailto:{{contactEmail}}" style="color: {{primaryColor}}; text-decoration: none;">{{contactEmail}}</a>.</p>`
      )
    }
  ],
  verification: [
    {
      name: "Store Default",
      description: "The standard system layout used currently",
      theme: "system",
      body: systemBaseTemplate(
        "Your Verification Code",
        `<p>Hi <strong>{{name}}</strong>,</p>
        <p>{{actionText}} Please enter the following 6-digit code to activate your account. This code will expire in 24 hours.</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; padding: 16px 32px; background: #f3f4f6; color: #111; border-radius: 8px; font-weight: bold; font-size: 32px; letter-spacing: 8px;">{{otp}}</span>
        </div>`
      )
    }
  ],
  resetPassword: [
    {
      name: "Store Default",
      description: "The standard system layout used currently",
      theme: "system",
      body: systemBaseTemplate(
        "Password Reset Code",
        `<p>Hi <strong>{{name}}</strong>,</p>
        <p>We received a request to reset your password. Please enter the following 6-digit code to choose a new password. This code will expire in 15 minutes.</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; padding: 16px 32px; background: #f3f4f6; color: #111; border-radius: 8px; font-weight: bold; font-size: 32px; letter-spacing: 8px;">{{otp}}</span>
        </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{resetLink}}" style="display: inline-block; padding: 12px 24px; background: {{primaryColor}}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to {{portalName}}</a>
          </div>
        <p style="font-size: 13px; color: #6b7280;">If you didn't make this request, you can safely ignore this email.</p>`
      )
    }
  ],
  driverPin: [
    {
      name: "Store Default",
      description: "The standard system layout used currently",
      theme: "system",
      body: systemBaseTemplate(
        "🚗 Driver Access PIN Generated",
        `<p>Hi <strong>{{driverName}}</strong>,</p>
        <p>Your access PIN for the delivery management system has been generated by the admin. Use this PIN to log in and manage your deliveries, vehicle assignments, and driver profile.</p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <p style="margin-top: 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your PIN</p>
          <p style="display: inline-block; padding: 12px 24px; background: white; color: #10b981; border-radius: 8px; font-weight: bold; font-size: 28px; border: 2px solid #10b981; margin: 10px 0; text-align: center;">{{pin}}</p>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin-top: 0; font-size: 14px;">📋 Important Information:</h3>
          <ul style="margin-bottom: 0; line-height: 1.8;">
            <li><strong>Keep your PIN confidential</strong> - Never share it with others</li>
            <li><strong>System URL:</strong> <a href="{{systemUrl}}" style="color: {{primaryColor}}; text-decoration: none; font-weight: bold;">{{systemUrl}}</a></li>
            <li><strong>Phone:</strong> {{phone}}</li>
          </ul>
        </div>`
      )
    }
  ],
  autoRestock: [
    {
      name: "Store Default",
      description: "The standard system layout used currently",
      theme: "system",
      body: systemBaseTemplate(
        "Restock Alert - {{storeName}}",
        `<p>Hello,</p>
        <p>Your AI inventory prediction system has identified items running critically low on stock. We recommend restocking the following products to prevent stockouts:</p>
        <table style="width: 100%; border-collapse: collapse; text-align: left; margin: 20px 0;">
          <thead>
            <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
              <th style="padding: 12px; font-weight: 600;">Product</th>
              <th style="padding: 12px; font-weight: 600;">Details</th>
              <th style="padding: 12px; font-weight: 600; text-align: center;">Stock</th>
              <th style="padding: 12px; font-weight: 600; text-align: center;">14d Sales</th>
              <th style="padding: 12px; font-weight: 600; text-align: center;">Suggested PO</th>
            </tr>
          </thead>
          <tbody>
            {{itemsHtml}}
          </tbody>
        </table>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{dashboardLink}}" style="display: inline-block; padding: 12px 24px; background: {{primaryColor}}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Inventory in Dashboard</a>
        </div>
        <p style="font-size: 13px; color: #9ca3af; text-align: center;">This is an automated message from your store's AI Inventory Manager.</p>`
      )
    }
  ],
  broadcast: [
    {
      name: "Store Default",
      description: "The standard system layout used currently",
      theme: "system",
      body: systemBaseTemplate(
        "See what's trending at {{storeName}}! 🔥",
        `<p>Hi <strong>{{userName}}</strong>,</p>
        <p>We noticed you might be interested in what's selling fast this week. Grab them before they run out of stock!</p>
        <p>As a special gift, use your unique discount code <strong style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px; letter-spacing: 1px; color: {{primaryColor}};">{{uniqueCode}}</strong> at checkout for 15% off your entire order!</p>
        <ul>
          {{productListHtml}}
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{storeUrl}}/products?featured=true" style="display: inline-block; padding: 12px 24px; background: {{primaryColor}}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Shop Trending Products</a>
        </div>`
      )
    }
  ],
  aiMarketing: [
    {
      name: "Store Default",
      description: "The standard system layout used currently",
      theme: "system",
      body: systemBaseTemplate(
        "Special Offer for {{userName}}! 🎁",
        `<p>{{aiContent}}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{storeUrl}}/products" style="display: inline-block; padding: 12px 24px; background: {{primaryColor}}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Shop Now</a>
        </div>`
      )
    }
  ],
  managerWelcome: [
    {
      name: "Store Default",
      description: "The standard system layout used currently",
      theme: "system",
      body: systemBaseTemplate(
          "Welcome to the {{portalName}}",
        `<p>Hi <strong>{{name}}</strong>,</p>
          <p>You have been added as an administrator or manager at {{storeName}}.</p>
          <p>You can access your dashboard using the link below:</p>
          <div style="text-align: center; margin: 30px 0;"><a href="{{portalUrl}}" style="display: inline-block; padding: 12px 24px; background: {{primaryColor}}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to {{portalName}}</a></div>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <p style="margin: 0 0 10px 0;"><strong>Your Login Credentials:</strong></p>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Email:</strong> {{email}}</li>
            <li><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-size: 16px;">{{temporaryPassword}}</code></li>
          </ul>
        </div>
        <p style="color: #ef4444; font-weight: 600;">Note: You will be required to change this password immediately after your first login.</p>`
      )
    }
  ]
};

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    name: "Order Confirmation",
    key: "orderConfirmation",
    subject: "Order Confirmed! - {{orderNumber}}",
    body: TEMPLATE_DESIGNS.orderConfirmation[0].body,
    description: "Sent when a customer places an order",
    variables: ["orderNumber", "total", "subtotal", "shippingCost", "itemsHtml", "shippingFullName", "orderLink", "storeName", "contactEmail", "customMessage", "primaryColor", "emailBackgroundColor"],
    category: "transactional",
    designs: TEMPLATE_DESIGNS.orderConfirmation
  },
  {
    name: "Shipping Notification",
    key: "shipping",
    subject: "Your order has shipped! - {{orderNumber}}",
    body: TEMPLATE_DESIGNS.shipping[0].body,
    description: "Sent when an order ships",
    variables: ["orderNumber", "trackingNumber", "trackingHtml", "trackLink", "shippingFullName", "shippingAddress", "shippingCity", "customMessage", "storeName", "primaryColor", "emailBackgroundColor"],
    category: "transactional",
    designs: TEMPLATE_DESIGNS.shipping
  },
  {
    name: "Abandoned Cart",
    key: "abandonedCart",
    subject: "Did you forget something? Complete your order at {{storeName}}",
    body: TEMPLATE_DESIGNS.abandonedCart[0].body,
    description: "Sent 24 hours after cart abandonment",
    variables: ["shippingFullName", "storeName", "itemsHtml", "orderNumber", "total", "orderLink", "primaryColor", "emailBackgroundColor"],
    designs: TEMPLATE_DESIGNS.abandonedCart
  },
  {
    name: "Order Cancelled",
    key: "orderCancelled",
    subject: "Your Order {{orderNumber}} has been Cancelled",
    body: TEMPLATE_DESIGNS.orderCancelled[0].body,
    description: "Sent when an order is cancelled",
    variables: ["orderNumber", "total", "shippingFullName", "storeName", "contactEmail", "primaryColor", "emailBackgroundColor"],
    designs: TEMPLATE_DESIGNS.orderCancelled
  },
  {
    name: "Email Verification",
    key: "verification",
    subject: "Verify your email - {{storeName}}",
    body: TEMPLATE_DESIGNS.verification[0].body,
    description: "Sent when a customer signs up or requests verification",
    variables: ["storeName", "name", "otp", "actionText", "contactEmail", "primaryColor", "emailBackgroundColor"],
    designs: TEMPLATE_DESIGNS.verification
  },
  {
    name: "Password Reset",
    key: "resetPassword",
    subject: "Password Reset Request - {{storeName}}",
    body: TEMPLATE_DESIGNS.resetPassword[0].body,
    description: "Sent when a customer requests a password reset",
    variables: ["storeName", "name", "otp", "contactEmail", "primaryColor", "emailBackgroundColor", "resetLink", "portalName"],
    designs: TEMPLATE_DESIGNS.resetPassword
  },
  {
    name: "Driver Access PIN",
    key: "driverPin",
    subject: "Welcome! Your Driver Access Credentials",
    body: TEMPLATE_DESIGNS.driverPin[0].body,
    description: "Sent to new drivers or during PIN reset",
    variables: ["storeName", "driverName", "pin", "phone", "systemUrl", "contactEmail", "primaryColor", "emailBackgroundColor"],
    designs: TEMPLATE_DESIGNS.driverPin
  },
  {
    name: "Auto Restock Alert",
    key: "autoRestock",
    subject: "Restock Alert - {{storeName}}",
    body: TEMPLATE_DESIGNS.autoRestock[0].body,
    description: "Sent to admin when inventory is critically low",
    variables: ["storeName", "itemsHtml", "dashboardLink", "primaryColor", "emailBackgroundColor"],
    category: "admin",
    designs: TEMPLATE_DESIGNS.autoRestock
  },
  {
    name: "Marketing Broadcast",
    key: "broadcast",
    subject: "See what's trending at {{storeName}}! 🔥",
    body: TEMPLATE_DESIGNS.broadcast[0].body,
    description: "Promotional email for trending products",
    variables: ["storeName", "userName", "uniqueCode", "productListHtml", "storeUrl", "primaryColor", "emailBackgroundColor"],
    category: "marketing",
    designs: TEMPLATE_DESIGNS.broadcast
  },
  {
    name: "AI Marketing Campaign",
    key: "aiMarketing",
    subject: "Special Offer for {{userName}}! 🎁",
    body: TEMPLATE_DESIGNS.aiMarketing[0].body,
    description: "Personalized AI generated marketing email",
    variables: ["storeName", "userName", "aiContent", "storeUrl", "primaryColor", "emailBackgroundColor"],
    category: "marketing",
    designs: TEMPLATE_DESIGNS.aiMarketing
  },
  {
    name: "Manager Welcome",
    key: "managerWelcome",
    subject: "Welcome to the Manager Portal - {{storeName}}",
    body: TEMPLATE_DESIGNS.managerWelcome[0].body,
    description: "Sent to new managers when they are added to the system",
    variables: ["storeName", "name", "email", "temporaryPassword", "portalUrl", "portalName", "primaryColor", "emailBackgroundColor"],
    category: "admin",
    designs: TEMPLATE_DESIGNS.managerWelcome
  },
];

interface EmailTemplateEditorProps {
  onClose: () => void;
}

export default function EmailTemplateEditor({ onClose }: EmailTemplateEditorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>(EMAIL_TEMPLATES[0]);
  const [selectedDesign, setSelectedDesign] = useState<TemplateDesign | null>(
    selectedTemplate.designs?.[0] || null
  );
  const [subject, setSubject] = useState(selectedTemplate.subject);
  const [body, setBody] = useState(selectedTemplate.body);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Visual Builder State
  const [builderBlocks, setBuilderBlocks] = useState<VisualBlock[]>([
    { id: '1', type: 'header', content: 'Update from {{storeName}}' },
    { id: '2', type: 'text', content: 'Hi {{name}}, here is the latest update.' },
    { id: '3', type: 'divider', content: '' },
    { id: '4', type: 'button', content: 'View Details' }
  ]);
  
  // Calculate responsive initial sizes based on viewport
  const getInitialDimensions = () => {
    const maxWidth = Math.min(window.innerWidth - 40, 1400);
    const maxHeight = Math.min(window.innerHeight - 40, 800);
    const initialX = Math.max(20, (window.innerWidth - maxWidth) / 2);
    const initialY = Math.max(20, (window.innerHeight - maxHeight) / 2);
    return { width: maxWidth, height: maxHeight, x: initialX, y: initialY };
  };

  const [dialogWidth, setDialogWidth] = useState(() => getInitialDimensions().width);
  const [dialogHeight, setDialogHeight] = useState(() => getInitialDimensions().height);
  const [dialogX, setDialogX] = useState(() => getInitialDimensions().x);
  const [dialogY, setDialogY] = useState(() => getInitialDimensions().y);
  const [isResizing, setIsResizing] = useState<"right" | "bottom" | "corner" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0, width: 0, height: 0, initialX: 0, initialY: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateSetting = trpc.admin.updateSetting.useMutation();
  const sendTestEmailMutation = trpc.admin.sendTestEmail.useMutation();
  const { data: emailSettingsData } = trpc.admin.getSetting.useQuery({ key: "email" });
  const lastLoadedKeyRef = useRef<string | null>(null);

  // Constrain position to keep dialog within viewport
  const constrainPosition = (x: number, y: number, width: number, height: number) => {
    const padding = 20;
    const maxX = Math.max(0, window.innerWidth - width - padding);
    const maxY = Math.max(0, window.innerHeight - height - padding);
    return {
      x: Math.max(padding, Math.min(x, maxX)),
      y: Math.max(padding, Math.min(y, maxY)),
    };
  };

  // Constrain size to keep dialog within viewport
  const constrainSize = (width: number, height: number) => {
    const padding = 40;
    return {
      width: Math.max(600, Math.min(width, window.innerWidth - padding)),
      height: Math.max(400, Math.min(height, window.innerHeight - padding)),
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - startPosRef.current.x;
        const deltaY = e.clientY - startPosRef.current.y;
        const newX = startPosRef.current.initialX + deltaX;
        const newY = startPosRef.current.initialY + deltaY;
        const constrained = constrainPosition(newX, newY, dialogWidth, dialogHeight);
        setDialogX(constrained.x);
        setDialogY(constrained.y);
        return;
      }

      if (!isResizing) return;

      const deltaX = e.clientX - startPosRef.current.x;
      const deltaY = e.clientY - startPosRef.current.y;

      if (isResizing === "right" || isResizing === "corner") {
        const newWidth = startPosRef.current.width + deltaX;
        const constrained = constrainSize(newWidth, dialogHeight);
        setDialogWidth(constrained.width);
        // Adjust X position if resizing makes it go off-screen
        const posConstrained = constrainPosition(dialogX, dialogY, constrained.width, dialogHeight);
        setDialogX(posConstrained.x);
      }
      if (isResizing === "bottom" || isResizing === "corner") {
        const newHeight = startPosRef.current.height + deltaY;
        const constrained = constrainSize(dialogWidth, newHeight);
        setDialogHeight(constrained.height);
        // Adjust Y position if resizing makes it go off-screen
        const posConstrained = constrainPosition(dialogX, dialogY, dialogWidth, constrained.height);
        setDialogY(posConstrained.y);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      setIsDragging(false);
    };

    if (isResizing || isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing, isDragging, dialogWidth, dialogHeight, dialogX, dialogY]);

  const handleResizeStart = (type: "right" | "bottom" | "corner", e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(type);
    startPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: dialogWidth,
      height: dialogHeight,
      initialX: dialogX,
      initialY: dialogY,
    };
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (isFullscreen) return;
    e.preventDefault();
    setIsDragging(true);
    startPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: dialogX,
      height: dialogY,
      initialX: dialogX,
      initialY: dialogY,
    };
  };

  const handleSafeClose = () => {
    if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Are you sure you want to discard them and close?")) {
      return;
    }
    onClose();
  };

  // Load saved custom template into the editor when the template changes
  useEffect(() => {
    if (!emailSettingsData) return;
    if (lastLoadedKeyRef.current === selectedTemplate.key) return; // already loaded this one

    const settingsValue = (emailSettingsData as any)?.value || emailSettingsData;

    if (settingsValue?.customTemplates?.[selectedTemplate.key]) {
      setBody(settingsValue.customTemplates[selectedTemplate.key]);
      setSelectedDesign(null);
    } else {
      setBody(selectedTemplate.designs?.[0]?.body || selectedTemplate.body);
      setSelectedDesign(selectedTemplate.designs?.[0] || null);
    }
    lastLoadedKeyRef.current = selectedTemplate.key;
  }, [selectedTemplate.key, emailSettingsData]);

  const handleSelectTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setSubject(template.subject);
    setHasUnsavedChanges(false);
  };

  const handleSelectDesign = (design: TemplateDesign) => {
    setSelectedDesign(design);
    setBody(design.body);
    setHasUnsavedChanges(true);
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      const currentEmailSettings = (emailSettingsData as any)?.value || emailSettingsData || {};
      const customTemplates = currentEmailSettings.customTemplates || {};

      await updateSetting.mutateAsync({
        key: "email",
        value: {
          ...currentEmailSettings,
          customTemplates: {
            ...customTemplates,
            [selectedTemplate.key]: body,
          }
        }
      });
      toast.success(`${selectedTemplate.name} template saved!`);
      setHasUnsavedChanges(false);
    } catch (error) {
      toast.error("Failed to save template");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleInsertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = body.substring(0, start) + `{{${variable}}}` + body.substring(end);
      setBody(newBody);
      setHasUnsavedChanges(true);
      textarea.focus();
      setTimeout(() => textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4), 0);
    }
  };

  const sampleVars: Record<string, string> = {
    orderNumber: "#ORD-12345",
    orderDate: new Date().toLocaleDateString(),
    totalAmount: "$999.99",
    subtotal: "$950.00",
    shippingCost: "$49.99",
    total: "$999.99",
    itemsList: "<li>Product 1 - $500</li><li>Product 2 - $499.99</li>",
    itemsHtml: `<tr><td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px; color: #374151; vertical-align: middle;"><img src="https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=100&q=80" alt="Product" width="40" style="border-radius: 4px; margin-right: 10px; vertical-align: middle; object-fit: contain;" /><a href="#" target="_blank" style="color: #1f2937; text-decoration: none; font-weight: 600; vertical-align: middle;">Awesome Laptop</a> <span style="color: #6b7280;">(x1)</span></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-size: 13px; color: #374151; vertical-align: middle;">$950.00</td></tr>`,
    customerName: "Alex Customer",
    name: "Alex Customer",
    shippingFullName: "Alex Customer",
    shippingAddress: "123 Tech Lane",
    shippingCity: "Silicon Valley",
    trackingNumber: "TRK1234567890",
    trackingHtml: `<div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 24px 0; border: 1px solid #e5e7eb;"><p style="margin: 0 0 4px 0; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Tracking Number</p><a href="#" style="font-size: 18px; font-family: monospace; font-weight: bold; color: #3b82f6; text-decoration: none;">TRK1234567890</a></div>`,
    estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    trackingUrl: "#",
    trackLink: "#",
    storeName: "Your Store",
    checkoutUrl: "#",
    cancellationReason: "Customer request",
    refundStatus: "Processing",
    supportEmail: "support@yourstore.com",
    contactEmail: "support@yourstore.com",
    email: "customer@example.com",
    verificationLink: "#",
    resetLink: "#",
    otp: "123456",
    actionText: "Welcome to Your Store!",
    portalName: "Store Dashboard",
    driverName: "Alex Driver",
    pin: "AB12CD",
    portalUrl: "https://yourstore.com/123",
    phone: "+1 234 567 890",
    systemUrl: "#",
    dashboardLink: "https://yourstore.com/admin/products",
    storeUrl: "https://yourstore.com",
    aiContent: "Based on your recent browsing, we thought you'd love these new arrivals!",
    uniqueCode: "SUMMER15",
    productListHtml: "<li>Product A - $99</li><li>Product B - $149</li>",
    userName: "Alex",
    primaryColor: "#3b82f6",
    emailBackgroundColor: "#ffffff",
    customMessage: "Thank you for your order. We are getting your items ready for shipment.",
  };

  const getPreviewHtml = () => {
    let preview = body || "";
    Object.entries(sampleVars).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`{{${key}}}`, "g"), value);
    });
    return preview;
  };

  const getPreviewSubject = () => {
    let preview = subject || "";
    Object.entries(sampleVars).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`{{${key}}}`, "g"), value);
    });
    return preview;
  };

  const handleSendTest = () => {
    if (!testEmail) return toast.error("Enter a test email address");
    sendTestEmailMutation.mutate({ email: testEmail, subject: getPreviewSubject(), body: getPreviewHtml() }, {
      onSuccess: () => toast.success("Test email sent successfully!"),
      onError: (err) => toast.error(err.message)
    });
  };

  const renderPreview = () => {
    return (
      <div 
        className="border rounded-lg p-6 bg-white overflow-auto"
        dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
      />
    );
  };

  // Visual Builder Handlers
  const handleDragStartBlock = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("blockIndex", index.toString());
  };

  const handleDropBlock = (e: React.DragEvent, targetIndex: number) => {
    const sourceIndex = parseInt(e.dataTransfer.getData("blockIndex"));
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;
    
    const newBlocks = [...builderBlocks];
    const [moved] = newBlocks.splice(sourceIndex, 1);
    newBlocks.splice(targetIndex, 0, moved);
    setBuilderBlocks(newBlocks);
  };

  const addVisualBlock = (type: VisualBlock['type']) => {
    const newBlock: VisualBlock = { id: Date.now().toString(), type, content: type === 'divider' ? '' : 'New Content' };
    setBuilderBlocks([...builderBlocks, newBlock]);
  };

  const removeVisualBlock = (index: number) => {
    setBuilderBlocks(builderBlocks.filter((_, i) => i !== index));
  };

  const generateHtmlFromBlocks = () => {
    let html = `<div style="font-family: system-ui, -apple-system, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">\n`;
    html += `  <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;"><h2 style="margin-top: 0; color: #111; text-align: center;">{{storeName}}</h2></div>\n`;
    
    builderBlocks.forEach(b => {
      const cStyle = b.color ? `color: ${b.color};` : '';
      const fStyle = b.fontFamily ? `font-family: ${b.fontFamily};` : '';
      const combinedStyle = `${cStyle} ${fStyle}`.trim();

      if (b.type === 'header') html += `  <h1 style="font-size: 24px; text-align: center; margin-bottom: 20px; ${cStyle || 'color: #3b82f6;'} ${fStyle}">${b.content}</h1>\n`;
      else if (b.type === 'text') html += `  <p style="font-size: 16px; line-height: 1.6; ${cStyle || 'color: #374151;'} ${fStyle}">${b.content}</p>\n`;
      else if (b.type === 'button') html += `  <div style="text-align: center; margin: 30px 0;"><a href="#" style="display: inline-block; padding: 12px 24px; background: ${b.color || '#3b82f6'}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; ${fStyle}">${b.content}</a></div>\n`;
      else if (b.type === 'image') html += `  <div style="text-align: center; margin: 20px 0;"><img src="${b.content || 'https://via.placeholder.com/600x200'}" alt="Image" style="max-width: 100%; height: auto; border-radius: 8px;" /></div>\n`;
      else if (b.type === 'spacer') html += `  <div style="height: ${parseInt(b.content) || 30}px; line-height: ${parseInt(b.content) || 30}px;">&nbsp;</div>\n`;
      else if (b.type === 'divider') html += `  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />\n`;
      else if (b.type === 'variables') html += `  <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb;">\n    ${b.content}\n  </div>\n`;
    });
    
    html += `</div>`;
    setBody(html);
    setHasUnsavedChanges(true);
    toast.success("Custom HTML Generated from Visual Builder!");
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && handleSafeClose()}>
      <DialogContent
        ref={dialogRef}
        className="fixed overflow-hidden bg-background border rounded-lg shadow-2xl z-50 flex flex-col p-0 gap-0 max-w-none sm:max-w-none m-0 !translate-x-0 !translate-y-0 data-[state=open]:!duration-0 [&>button:last-child]:hidden"
        style={{
          width: isFullscreen ? '100vw' : `${dialogWidth}px`,
          height: isFullscreen ? '100vh' : `${dialogHeight}px`,
          left: isFullscreen ? 0 : `${dialogX}px`,
          top: isFullscreen ? 0 : `${dialogY}px`,
          boxShadow: isFullscreen ? "none" : "0 20px 60px rgba(0, 0, 0, 0.3)",
          transform: "none",
          borderRadius: isFullscreen ? 0 : undefined,
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Email Template Editor</DialogTitle>
          <DialogDescription>Customize email templates</DialogDescription>
        </DialogHeader>
        {/* Draggable Header */}
        <div 
          className={`flex-shrink-0 border-b px-6 py-4 bg-background transition-colors flex justify-between items-center ${!isFullscreen ? 'cursor-move hover:bg-muted/30' : ''}`}
          onMouseDown={handleDragStart}
          title={!isFullscreen ? "Drag to move the window" : ""}
        >
          <div className="select-none pointer-events-none flex-1">
            <div className="flex items-center gap-2 text-xl font-bold font-display">
              <Mail size={24} className="text-primary" /> Email Template Editor
              {hasUnsavedChanges && <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-2 border border-amber-200">Unsaved Changes</span>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Customize email templates or build your own with the visual editor</p>
          </div>
          <div className="flex gap-2 pointer-events-auto ml-4">
            <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? "Restore down" : "Maximize"}>
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSafeClose} className="hover:bg-destructive hover:text-destructive-foreground" title="Close">
              <X size={18} />
            </Button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-4 gap-4">
            {/* Template Sidebar */}
            <div className="col-span-1 border-r border-border pr-4 h-[calc(100vh-200px)] overflow-y-auto">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Templates</h3>
              <div className="space-y-2">
                {EMAIL_TEMPLATES.map((template) => (
                  <button
                    key={template.key}
                    onClick={() => handleSelectTemplate(template)}
                    className={`w-full text-left p-3 rounded-lg text-sm transition-all duration-200 ${
                      selectedTemplate.key === template.key
                        ? "bg-primary text-primary-foreground shadow-lg scale-105"
                        : "bg-secondary hover:bg-secondary/80 text-foreground"
                    }`}
                  >
                    <div className="font-semibold">{template.name}</div>
                    <div className="text-xs opacity-75 mt-1">{template.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Editor Area */}
            <div className="col-span-3 space-y-4">
              <Tabs defaultValue="design">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="design" className="flex items-center gap-2">
                    <Palette size={16} />
                    Design
                  </TabsTrigger>
                  <TabsTrigger value="visual" className="flex items-center gap-2">
                    <LayoutTemplate size={16} />
                    Visual Builder
                  </TabsTrigger>
                  <TabsTrigger value="edit" className="flex items-center gap-2">
                    <Code size={16} />
                    Custom
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex items-center gap-2">
                    <Eye size={16} />
                    Preview
                  </TabsTrigger>
                </TabsList>

                {/* Design Templates Tab */}
                <TabsContent value="design" className="space-y-4">
                  {selectedTemplate.designs && selectedTemplate.designs.length > 0 ? (
                    <>
                      <div>
                        <h4 className="font-semibold text-sm mb-3">Choose a Template Design</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {selectedTemplate.designs.map((design, idx) => (
                            <Card
                              key={idx}
                              className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                                selectedDesign?.name === design.name
                                  ? "ring-2 ring-primary border-primary"
                                  : "hover:border-primary/50"
                              }`}
                              onClick={() => handleSelectDesign(design)}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${getThemeColor(design.theme)}`}>
                                  <Zap size={18} />
                                </div>
                                <div className="flex-1">
                                  <h5 className="font-semibold text-sm">{design.name}</h5>
                                  <p className="text-xs text-muted-foreground mt-1">{design.description}</p>
                                  <span className="inline-block mt-2 px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded">
                                    {design.theme}
                                  </span>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>

                      {/* Current Design Preview */}
                      <Card className="p-4 bg-secondary/30">
                        <h4 className="font-semibold text-sm mb-3">Design Preview</h4>
                        <div 
                          className="border rounded-lg p-4 bg-white overflow-auto max-h-[300px]"
                          dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                        />
                      </Card>
                    </>
                  ) : (
                    <Card className="p-8 text-center text-muted-foreground">
                      <BookOpen size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="font-medium text-foreground">No pre-designed templates available for this email type.</p>
                      <p className="text-sm">Use the "Custom" tab to create your own.</p>
                    </Card>
                  )}
                </TabsContent>

                {/* Visual Builder Tab */}
                <TabsContent value="visual" className="space-y-4">
                  <Card className="p-4 bg-muted/20 border-dashed">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold text-sm">Visual Layout Builder</h4>
                      <Button onClick={generateHtmlFromBlocks} size="sm" className="bg-primary text-white gap-2">
                        <Code size={14} /> Generate HTML Code
                      </Button>
                    </div>
                    <div className="space-y-3 mb-6">
                      {builderBlocks.map((block, idx) => (
                        <div 
                          key={block.id} 
                          draggable
                          onDragStart={(e) => handleDragStartBlock(e, idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleDropBlock(e, idx)}
                          className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg shadow-sm group hover:border-primary/50 transition-all cursor-move"
                        >
                          <GripVertical size={16} className="text-muted-foreground opacity-50 group-hover:opacity-100" />
                          <span className="text-xs font-bold uppercase tracking-wider w-20 shrink-0 text-primary">{block.type}</span>
                          {block.type !== 'divider' ? (
                            <Input 
                              value={block.content} 
                              placeholder={
                                block.type === 'image' ? 'Image URL (e.g. https://...)' : 
                                block.type === 'spacer' ? 'Height in pixels (e.g. 30)' : 
                                'Block content...'
                              }
                              onChange={(e) => {
                                const newBlocks = [...builderBlocks];
                                newBlocks[idx].content = e.target.value;
                                setBuilderBlocks(newBlocks);
                                setHasUnsavedChanges(true);
                              }}
                              className="h-8 bg-muted/50 border-transparent focus-visible:border-primary focus-visible:ring-1"
                            />
                          ) : (
                            <div className="flex-1 border-t-2 border-dashed border-border" />
                          )}
                          {['header', 'text', 'button'].includes(block.type) && (
                            <div className="flex items-center gap-1.5 ml-1">
                              <input 
                                type="color"
                                value={block.color || (block.type === 'button' ? '#3b82f6' : '#000000')}
                                onChange={(e) => {
                                  const newBlocks = [...builderBlocks];
                                  newBlocks[idx].color = e.target.value;
                                  setBuilderBlocks(newBlocks);
                                  setHasUnsavedChanges(true);
                                }}
                                className="w-6 h-6 p-0 border-0 cursor-pointer bg-transparent shrink-0"
                                title="Color"
                              />
                              <select
                                value={block.fontFamily || 'system-ui'}
                                onChange={(e) => {
                                  const newBlocks = [...builderBlocks];
                                  newBlocks[idx].fontFamily = e.target.value;
                                  setBuilderBlocks(newBlocks);
                                  setHasUnsavedChanges(true);
                                }}
                                className="h-7 text-xs rounded border border-border bg-background px-1 max-w-[80px]"
                              >
                                <option value="system-ui">System</option>
                                <option value="sans-serif">Sans</option>
                                <option value="serif">Serif</option>
                                <option value="monospace">Mono</option>
                              </select>
                            </div>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 opacity-50 group-hover:opacity-100" onClick={() => removeVisualBlock(idx)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      ))}
                      {builderBlocks.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
                          <Layers size={24} className="mx-auto mb-2 opacity-50" />
                          Drag and drop elements here to build your email
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                      <span className="text-xs font-semibold text-muted-foreground uppercase py-2 mr-2">Add Block:</span>
                      <Button variant="outline" size="sm" onClick={() => addVisualBlock('header')}><Plus size={14} className="mr-1"/> Header</Button>
                      <Button variant="outline" size="sm" onClick={() => addVisualBlock('text')}><Plus size={14} className="mr-1"/> Text</Button>
                      <Button variant="outline" size="sm" onClick={() => addVisualBlock('button')}><Plus size={14} className="mr-1"/> Button</Button>
                      <Button variant="outline" size="sm" onClick={() => addVisualBlock('variables')}><Plus size={14} className="mr-1"/> Data / Variables</Button>
                      <Button variant="outline" size="sm" onClick={() => addVisualBlock('divider')}><Plus size={14} className="mr-1"/> Divider</Button>
                      <Button variant="outline" size="sm" onClick={() => addVisualBlock('image')}><ImageIcon size={14} className="mr-1"/> Image</Button>
                      <Button variant="outline" size="sm" onClick={() => addVisualBlock('spacer')}><MoveVertical size={14} className="mr-1"/> Spacer</Button>
                    </div>
                  </Card>
                </TabsContent>

                {/* Custom Editor Tab */}
                <TabsContent value="edit" className="space-y-4">
                  <Card className="p-4">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">Subject Line</label>
                        <Input
                          value={subject}
                          onChange={(e) => { setSubject(e.target.value); setHasUnsavedChanges(true); }}
                          placeholder="e.g., Order Confirmed - {{orderNumber}}"
                          className="font-mono text-sm"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-semibold">Email Body (HTML)</label>
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => { if(confirm("Reset custom code to the currently selected design?")) setBody(selectedDesign?.body || selectedTemplate.body); }}
                          >
                            <RotateCcw size={12} /> Reset to Design
                          </Button>
                        </div>
                        <Textarea
                          ref={textareaRef}
                          value={body}
                          onChange={(e) => {
                            setBody(e.target.value);
                            setHasUnsavedChanges(true);
                          }}
                          placeholder="Enter email HTML here..."
                          rows={10}
                          className="font-mono text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2">Available Variables</label>
                        <div className="flex flex-wrap gap-2">
                          {selectedTemplate.variables.map((variable) => (
                            <code
                              key={variable}
                              role="button"
                              tabIndex={0}
                              aria-label={`Insert ${variable} variable`}
                              className="bg-primary/10 text-primary px-3 py-1 rounded text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors border border-primary/20"
                              title="Click to insert"
                              onClick={() => handleInsertVariable(variable)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleInsertVariable(variable);
                                }
                              }}
                            >
                              {`{{${variable}}}`}
                            </code>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Click any variable to insert it at your cursor position</p>
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                {/* Preview Tab */}
                <TabsContent value="preview" className="space-y-4">
                  <Card className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-sm font-semibold">Email Body Preview</label>
                      <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
                        <Button 
                          variant={previewDevice === 'desktop' ? 'secondary' : 'ghost'} 
                          size="sm" 
                          className={`h-7 px-3 text-xs ${previewDevice === 'desktop' ? 'shadow-sm bg-background' : ''}`}
                          onClick={() => setPreviewDevice('desktop')}
                        >
                          <Monitor size={14} className="mr-1.5" /> Desktop
                        </Button>
                        <Button 
                          variant={previewDevice === 'mobile' ? 'secondary' : 'ghost'} 
                          size="sm" 
                          className={`h-7 px-3 text-xs ${previewDevice === 'mobile' ? 'shadow-sm bg-background' : ''}`}
                          onClick={() => setPreviewDevice('mobile')}
                        >
                          <Smartphone size={14} className="mr-1.5" /> Mobile
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className={`overflow-auto border rounded-lg bg-gray-50/50 flex justify-center p-4 ${isFullscreen ? 'max-h-[65vh]' : 'max-h-[400px]'}`}>
                          <div className={`bg-white shadow-sm border border-border w-full transition-all duration-300 ${previewDevice === 'mobile' ? 'max-w-[375px]' : 'max-w-[600px]'}`}>
                            {renderPreview()}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2">Subject Preview</label>
                        <div className="bg-secondary p-3 rounded-lg font-semibold text-sm border border-border">
                          {getPreviewSubject()}
                        </div>
                      </div>
                    
                    <div className="flex flex-col sm:flex-row items-end gap-3 p-4 bg-muted/40 rounded-lg border border-border mt-4">
                      <div className="flex-1 space-y-1.5 w-full">
                        <label className="block text-sm font-semibold">Send Test Email</label>
                        <Input 
                          type="email" 
                          placeholder="Enter your email address to send a test..." 
                          value={testEmail} 
                          onChange={e => setTestEmail(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleSendTest} disabled={sendTestEmailMutation.isPending || !testEmail} className="gap-2 w-full sm:w-auto">
                        {sendTestEmailMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        Send Test
                      </Button>
                    </div>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex-shrink-0 border-t p-4 bg-muted/30 flex justify-end gap-3 items-center">
          <Button variant="outline" onClick={handleSafeClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSaveTemplate} disabled={saving} className="gap-2 bg-primary text-white"><Save size={18} /> {saving ? "Saving..." : "Save Template"}</Button>
        </div>

        {!isFullscreen && <div
          className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors"
          onMouseDown={(e) => handleResizeStart("right", e)}
        />}
        {!isFullscreen && <div
          className="absolute bottom-0 left-0 h-1 w-full cursor-row-resize hover:bg-primary/50 transition-colors"
          onMouseDown={(e) => handleResizeStart("bottom", e)}
        />}
        {!isFullscreen && <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize group"
          onMouseDown={(e) => handleResizeStart("corner", e)}
        >
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/30 group-hover:border-primary/100 transition-colors" />
        </div>}
      </DialogContent>
    </Dialog>
  );
}

function getThemeColor(theme: string): string {
  const colors: Record<string, string> = {
    system: "bg-indigo-100 text-indigo-600",
    modern: "bg-blue-100 text-blue-600",
    minimal: "bg-gray-100 text-gray-600",
    professional: "bg-amber-100 text-amber-600",
    creative: "bg-orange-100 text-orange-600",
  };
  return colors[theme] || "bg-gray-100 text-gray-600";
}
