export interface CommonEmailOptions {
  storeName: string;
  storeUrl?: string;
  logoUrl?: string;
  primaryColor?: string;
  contactEmail: string;
  emailBackgroundColor?: string;
  storePhone?: string;
  theme?: "modern" | "classic" | "minimal";
  customTemplate?: string;
}

function getStoreUrl(opts: CommonEmailOptions) {
  if (opts.storeUrl) return opts.storeUrl;
  const host = process.env.PUBLIC_URL || 'http://localhost:3000';
  return host.startsWith('http') ? host : `https://${host}`;
}

export function renderTemplate(template: string, vars: Record<string, any>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    return vars[key] !== undefined ? String(vars[key]) : match;
  });
}

function getHeaderHtml(storeName: string, logoUrl?: string) {
  return logoUrl 
    ? `<img src="${logoUrl}" alt="${storeName}" style="max-height: 50px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;" />` 
    : `<h2 style="margin-top: 0; color: #111; text-align: center;">${storeName}</h2>`;
}

function getBaseLayout(content: string, title: string, opts: CommonEmailOptions) {
  const theme = opts.theme || "modern";
  const logoHtml = getHeaderHtml(opts.storeName, opts.logoUrl);
  const primaryColor = opts.primaryColor || "#3b82f6";
  const footer = `Need help? Contact us at <a href="mailto:${opts.contactEmail}" style="color: ${primaryColor}; text-decoration: none;">${opts.contactEmail}</a>${opts.storePhone ? ` or call ${opts.storePhone}` : ''}.`;
  const bgColor = opts.emailBackgroundColor || '#ffffff';

  if (theme === 'classic') {
    return `
      <div style="font-family: Georgia, serif; color: #000; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #000; background-color: ${bgColor};">
        <div style="text-align: center; margin-bottom: 20px;">
          ${logoHtml}
          <h1 style="border-bottom: 1px solid #000; padding-bottom: 10px; color: ${primaryColor};">${title}</h1>
        </div>
        <div style="font-size: 16px; line-height: 1.6;">${content}</div>
        <div style="margin-top: 30px; border-top: 1px solid #000; padding-top: 15px; font-size: 12px; text-align: center;">
          ${footer}
        </div>
      </div>
    `;
  } else if (theme === 'minimal') {
    return `
      <div style="font-family: monospace; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: ${bgColor};">
        ${opts.logoUrl ? `<img src="${opts.logoUrl}" alt="${opts.storeName}" style="max-height: 40px; margin-bottom: 20px;" />` : `<h2>${opts.storeName}</h2>`}
        <h1 style="font-size: 20px; color: ${primaryColor};">${title}</h1>
        <div style="margin: 20px 0; font-size: 14px; line-height: 1.6;">${content}</div>
        <div style="margin-top: 40px; font-size: 12px; color: #999;">
          ${footer}
        </div>
      </div>
    `;
  }

  // modern (default)
  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); background-color: ${bgColor};">
      <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">
        ${logoHtml}
        <h1 style="font-size: 24px; margin: 0; color: ${primaryColor};">${title}</h1>
      </div>
      <div style="font-size: 16px; line-height: 1.6;">${content}</div>
      <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
        ${footer}
      </p>
    </div>
  `;
}

export function getVerificationEmailHtml(opts: CommonEmailOptions & { name: string; otp: string; isResend?: boolean }) {
  const actionText = opts.isResend ? `You requested a new verification code for ${opts.storeName}.` : `Welcome to ${opts.storeName}!`;
  if (opts.customTemplate) return renderTemplate(opts.customTemplate, { ...opts, actionText });
  const content = `
    <p>Hi <strong>${opts.name}</strong>,</p>
    <p>${actionText} Please enter the following 6-digit code to activate your account. This code will expire in 24 hours.</p>
    <div style="text-align: center; margin: 30px 0;">
      <span style="display: inline-block; padding: 16px 32px; background: #f3f4f6; color: #111; border-radius: 8px; font-weight: bold; font-size: 32px; letter-spacing: 8px;">${opts.otp}</span>
    </div>
  `;
  return getBaseLayout(content, "Your Verification Code", opts);
}

export function getResetPasswordEmailHtml(opts: CommonEmailOptions & { name: string; otp: string; resetLink?: string; portalName?: string }) {
  if (opts.customTemplate) return renderTemplate(opts.customTemplate, opts);
  
  const resetLink = opts.resetLink || `${getStoreUrl(opts)}/admin?reset=true`;
  const portalName = opts.portalName || "Admin Portal";
  
  const content = `
    <p>Hi <strong>${opts.name || 'there'}</strong>,</p>
    <p>We received a request to reset your password. Your 6-digit reset code is below and will expire in 
      <span style="display: inline-block; padding: 16px 32px; background: #f3f4f6; color: #111; border-radius: 8px; font-weight: bold; font-size: 32px; letter-spacing: 8px;">${opts.otp}</span>
    </div>
    <p style="text-align: center; margin: 20px 0;">
      <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: ${opts.primaryColor || '#3b82f6'}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to ${portalName}</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">If you didn't make this request, you can safely ignore this email.</p>
  `;
  return getBaseLayout(content, "Password Reset Code", opts);
}

export function getOrderConfirmationEmailHtml(opts: CommonEmailOptions & { shippingFullName: string; orderNumber: string; cartData: { name: string; slug?: string | null; price: string | number; quantity: number; image?: string | null }[]; subtotal: number; shippingCost: number; total: number; storeCurrency: string; customMessage?: string; orderLink: string; productImageWidth?: string | number; }) {
  const formatEmailPrice = (p: string | number) => new Intl.NumberFormat("en-US", { style: "currency", currency: opts.storeCurrency }).format(typeof p === "string" ? parseFloat(p) : p);

  const itemsHtml = opts.cartData.map(item => {
    const productLink = item.slug ? `${getStoreUrl(opts)}/products/${item.slug}` : `${getStoreUrl(opts)}/products`;
    const imgSrc = item.image || opts.logoUrl;
    const imgWidth = opts.productImageWidth || '40';
    const imageHtml = imgSrc ? `<img src="${imgSrc}" alt="${item.name}" width="${imgWidth}" style="border-radius: 4px; margin-right: 10px; vertical-align: middle; object-fit: contain;" />` : '';
    
    return `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px; color: #374151; vertical-align: middle;">
        ${imageHtml}
        <a href="${productLink}" target="_blank" style="color: #1f2937; text-decoration: none; font-weight: 600; vertical-align: middle;">${item.name}</a> 
        <span style="color: #6b7280;">(x${item.quantity})</span>
      </td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-size: 13px; color: #374151; vertical-align: middle;">${formatEmailPrice(parseFloat(item.price as string) * item.quantity)}</td>
    </tr>
  `}).join('');

  if (opts.customTemplate) return renderTemplate(opts.customTemplate, { ...opts, itemsHtml });
  const content = `
    <p>Hi <strong>${opts.shippingFullName}</strong>,</p>
    <p>${opts.customMessage || "Thank you for your order. We are getting your items ready for shipment."}</p>
    <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb;">
      <h3 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Order Summary (#${opts.orderNumber})</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        ${itemsHtml}
        <tr><td style="padding: 8px 0; font-weight: 600; padding-top: 12px;">Subtotal</td><td style="padding: 8px 0; text-align: right; font-weight: 600; padding-top: 12px;">${formatEmailPrice(opts.subtotal)}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 600;">Shipping</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatEmailPrice(opts.shippingCost)}</td></tr>
        <tr><td style="padding: 12px 0 0 0; font-size: 16px; font-weight: 700; border-top: 2px solid #e5e7eb;">Total</td><td style="padding: 12px 0 0 0; font-size: 16px; font-weight: 700; text-align: right; border-top: 2px solid #e5e7eb;">${formatEmailPrice(opts.total)}</td></tr>
      </table>
    </div>
    <div style="text-align: center; margin: 30px 0;"><a href="${opts.orderLink}" style="display: inline-block; padding: 12px 24px; background: ${opts.primaryColor || '#3b82f6'}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Order Details</a></div>
  `;
  return getBaseLayout(content, "Order Confirmed!", opts);
}

export function getShippingNotificationEmailHtml(opts: CommonEmailOptions & { shippingFullName: string; orderNumber: string; trackingNumber?: string; trackLink: string; customMessage?: string; shippingAddress: string; }) {
  const trackingHtml = opts.trackingNumber ? `<div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 24px 0; border: 1px solid #e5e7eb;"><p style="margin: 0 0 4px 0; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Tracking Number</p><a href="https://parcelsapp.com/en/tracking/${encodeURIComponent(opts.trackingNumber)}" target="_blank" style="font-size: 18px; font-family: monospace; font-weight: bold; color: ${opts.primaryColor || '#3b82f6'}; text-decoration: none;">${opts.trackingNumber}</a></div>` : ``;

  if (opts.customTemplate) return renderTemplate(opts.customTemplate, { ...opts, trackingHtml });
  const content = `
    <p>Hi <strong>${opts.shippingFullName}</strong>,</p>
    <p>${opts.customMessage || "Great news! Your order has been shipped and is on its way to you."}</p>
    <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0; font-size: 14px; border: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px 0;"><strong>Order Number:</strong> #${opts.orderNumber}</p>
      <p style="margin: 0;"><strong>Shipping To:</strong><br/>${opts.shippingAddress.replace(/\n/g, '<br/>')}</p>
    </div>
    ${trackingHtml}
    <div style="text-align: center; margin: 30px 0;"><a href="${opts.trackLink}" style="display: inline-block; padding: 12px 24px; background: ${opts.primaryColor || '#3b82f6'}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Track Your Order</a></div>
  `;
  return getBaseLayout(content, "Your Order Has Shipped!", opts);
}

export function getAbandonedCartEmailHtml(opts: CommonEmailOptions & { shippingFullName: string; orderNumber: string; total: string | number; orderLink: string; storeCurrency: string; cartData: { name: string; slug?: string | null; price: string | number; quantity: number; image?: string | null; }[]; productImageWidth?: string | number }) {
  const formatEmailPrice = (p: string | number) => new Intl.NumberFormat("en-US", { style: "currency", currency: opts.storeCurrency }).format(typeof p === "string" ? parseFloat(p) : p);

  const itemsHtml = opts.cartData.map(item => {
    const productLink = item.slug ? `${getStoreUrl(opts)}/products/${item.slug}` : `${getStoreUrl(opts)}/products`;
    const imgSrc = item.image || opts.logoUrl;
    const imgWidth = opts.productImageWidth || 40;
    const imageHtml = imgSrc ? `<img src="${imgSrc}" alt="${item.name}" width="${imgWidth}" style="border-radius: 4px; margin-right: 10px; vertical-align: middle; object-fit: contain;" />` : '';
    return `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px; color: #374151; vertical-align: middle;">
        ${imageHtml}
        <a href="${productLink}" target="_blank" style="color: #1f2937; text-decoration: none; font-weight: 600; vertical-align: middle;">${item.name}</a> 
        <span style="color: #6b7280;">(x${item.quantity})</span>
      </td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-size: 13px; color: #374151; vertical-align: middle;">${formatEmailPrice(parseFloat(item.price as string) * item.quantity)}</td>
    </tr>
  `}).join('');

  if (opts.customTemplate) return renderTemplate(opts.customTemplate, { ...opts, itemsHtml });
  const content = `
    <p>Hi <strong>${opts.shippingFullName}</strong>,</p>
    <p>We noticed you started an order but haven't completed the payment yet. Your items are currently saved, but they might sell out soon!</p>
    <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb;">
      <h3 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Your Cart (#${opts.orderNumber})</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        ${itemsHtml}
        <tr><td colspan="2" style="padding: 12px 0 0 0; font-size: 14px; font-weight: 700; border-top: 2px solid #e5e7eb; text-align: right;">Total: ${formatEmailPrice(opts.total)}</td></tr>
      </table>
    </div>
    <div style="text-align: center; margin: 30px 0;"><a href="${opts.orderLink}" style="display: inline-block; padding: 12px 24px; background: ${opts.primaryColor || '#3b82f6'}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Complete Your Order</a></div>
  `;
  return getBaseLayout(content, "You left something behind!", opts);
}

export function getOrderCancelledEmailHtml(opts: CommonEmailOptions & { shippingFullName: string; orderNumber: string; total: string | number; storeCurrency: string; }) {
  const formatEmailPrice = (p: string | number) => new Intl.NumberFormat("en-US", { style: "currency", currency: opts.storeCurrency }).format(typeof p === "string" ? parseFloat(p) : p);
  
  if (opts.customTemplate) return renderTemplate(opts.customTemplate, opts);
  const content = `
    <p>Hi <strong>${opts.shippingFullName}</strong>,</p>
    <p>This email confirms that your order <strong>#${opts.orderNumber}</strong> has been successfully cancelled.</p>
    <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0; text-align: center; border: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 14px; color: #4b5563;">If you have already paid, a refund for <strong>${formatEmailPrice(opts.total)}</strong> will be processed within 3-5 business days.</p>
    </div>
    <div style="text-align: center; margin: 30px 0;"><a href="${getStoreUrl(opts)}/products" style="display: inline-block; padding: 12px 24px; background: ${opts.primaryColor || '#3b82f6'}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Continue Shopping</a></div>
    <p style="font-size: 13px; color: #6b7280;">If you did not request this cancellation, please contact us immediately.</p>
  `;
  return getBaseLayout(content, "Order Cancelled", opts);
}

export function getAdminOrderCancelledEmailHtml(opts: CommonEmailOptions & { orderNumber: string; shippingFullName: string; shippingEmail: string | null; total: string | number; paymentStatus: string; reason?: string; storeCurrency: string; }) {
  const formatEmailPrice = (p: string | number) => new Intl.NumberFormat("en-US", { style: "currency", currency: opts.storeCurrency }).format(typeof p === "string" ? parseFloat(p) : p);

  if (opts.customTemplate) return renderTemplate(opts.customTemplate, opts);
  const content = `
    <p>A customer has just cancelled their order via the tracking page.</p>
    <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb;">
      <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
        <li><strong>Order Number:</strong> ${opts.orderNumber}</li>
        <li><strong>Customer:</strong> ${opts.shippingFullName} (${opts.shippingEmail || 'N/A'})</li>
        <li><strong>Total:</strong> ${formatEmailPrice(opts.total)}</li>
        <li><strong>Payment Status:</strong> ${opts.paymentStatus}</li>
        <li><strong>Reason:</strong> ${opts.reason || "None provided"}</li>
      </ul>
    </div>
    <p>Please log in to the Admin Panel > Orders to review this cancellation and process any necessary refunds.</p>
  `;
  return getBaseLayout(content, "Order Cancelled by Customer", opts);
}

export function getDriverPinEmailHtml(opts: CommonEmailOptions & { driverName: string; pin: string; phone: string; systemUrl?: string }) {
  if (opts.customTemplate) return renderTemplate(opts.customTemplate, opts);
  const content = `
    <p>Hi <strong>${opts.driverName}</strong>,</p>
    <p>Your access PIN for the delivery management system has been generated by the admin. Use this PIN to log in and manage your deliveries, vehicle assignments, and driver profile.</p>
    <div style="background-color: #f0fdf4; border-left: 4px solid ${opts.primaryColor || '#10b981'}; padding: 20px; margin: 25px 0; border-radius: 4px;">
      <p style="margin-top: 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your PIN</p>
      <p style="display: inline-block; padding: 12px 24px; background: white; color: ${opts.primaryColor || '#10b981'}; border-radius: 8px; font-weight: bold; font-size: 28px; border: 2px solid ${opts.primaryColor || '#10b981'}; margin: 10px 0; text-align: center;">${opts.pin}</p>
    </div>
    <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <h3 style="margin-top: 0; font-size: 14px;">📋 Important Information:</h3>
      <ul style="margin-bottom: 0; line-height: 1.8;">
        <li><strong>Keep your PIN confidential</strong> - Never share it with others</li>
        ${opts.systemUrl ? `<li><strong>System URL:</strong> <a href="${opts.systemUrl}" style="color: ${opts.primaryColor || '#10b981'}; text-decoration: none; font-weight: bold;">${opts.systemUrl}</a></li>` : '<li><strong>System URL:</strong> Your admin will provide the access portal</li>'}
        <li><strong>Phone:</strong> ${opts.phone}</li>
        <li>For security reasons, change your PIN after your first login</li>
      </ul>
    </div>
    ${opts.systemUrl ? `<div style="text-align: center; margin: 30px 0;"><a href="${opts.systemUrl}" style="display: inline-block; background-color: ${opts.primaryColor || '#10b981'}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">🚪 Login to Delivery Portal</a></div>` : ''}
    <p style="font-size: 13px; color: #6b7280;">If you did not request this PIN or have any questions, please contact your fleet manager immediately.</p>
  `;
  return getBaseLayout(content, "🚗 Driver Access PIN Generated", opts);
}

export function getBroadcastEmailHtml(opts: CommonEmailOptions & { userName: string; uniqueCode: string; productListHtml: string }) {
  if (opts.customTemplate) return renderTemplate(opts.customTemplate, opts);
  const content = `
    <p>Hi <strong>${opts.userName || 'there'}</strong>,</p>
    <p>We noticed you might be interested in what's selling fast this week. Grab them before they run out of stock!</p>
    <p>As a special gift, use your unique discount code <strong style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px; letter-spacing: 1px; color: ${opts.primaryColor || '#3b82f6'};">${opts.uniqueCode}</strong> at checkout for 15% off your entire order!</p>
    <ul>
      ${opts.productListHtml}
    </ul>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${getStoreUrl(opts)}/products?featured=true" style="display: inline-block; padding: 12px 24px; background: ${opts.primaryColor || '#3b82f6'}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Shop Trending Products</a>
    </div>
  `;
  return getBaseLayout(content, `See what's trending at ${opts.storeName}! 🔥`, opts);
}

export function getAIMarketingEmailHtml(opts: CommonEmailOptions & { userName: string; aiContent: string }) {
  if (opts.customTemplate) return renderTemplate(opts.customTemplate, opts);
  const content = `
    <p>${opts.aiContent}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${getStoreUrl(opts)}/products" style="display: inline-block; padding: 12px 24px; background: ${opts.primaryColor || '#3b82f6'}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Shop Now</a>
    </div>
  `;
  return getBaseLayout(content, `Special Offer for ${opts.userName || 'You'}! 🎁`, opts);
}

export function getAutoRestockEmailHtml(opts: CommonEmailOptions & { itemsHtml: string; dashboardLink: string }) {
  if (opts.customTemplate) return renderTemplate(opts.customTemplate, opts);
  const content = `
    <p>Hello,</p>
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
        ${opts.itemsHtml}
      </tbody>
    </table>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${opts.dashboardLink}" style="display: inline-block; padding: 12px 24px; background: ${opts.primaryColor || '#3b82f6'}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Inventory in Dashboard</a>
    </div>
    <p style="font-size: 13px; color: #9ca3af; text-align: center;">This is an automated message from your store's AI Inventory Manager.</p>
  `;
  return getBaseLayout(content, `Restock Alert - ${opts.storeName}`, opts);
}

export function getManagerWelcomeEmailHtml(opts: CommonEmailOptions & { name: string; email: string; temporaryPassword?: string; portalUrl: string; portalName?: string }) {
  if (opts.customTemplate) return renderTemplate(opts.customTemplate, opts);
  
  const portalName = opts.portalName || "Admin Portal";
  const content = `
    <p>Hi <strong>${opts.name}</strong>,</p>
    <p>You have been added as an administrator or manager at ${opts.storeName}.</p>
    <p>You can access your dashboard using the link below:</p>
    <div style="text-align: center; margin: 30px 0;"><a href="${opts.portalUrl}" style="display: inline-block; padding: 12px 24px; background: ${opts.primaryColor || '#3b82f6'}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to ${portalName}</a></div>
    ${opts.temporaryPassword ? `
    <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <p style="margin: 0 0 10px 0;"><strong>Your Login Credentials:</strong></p>
      <ul style="margin: 0; padding-left: 20px;">
        <li><strong>Email:</strong> ${opts.email}</li>
        <li><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-size: 16px;">${opts.temporaryPassword}</code></li>
      </ul>
    </div>
    <p style="color: #ef4444; font-weight: 600;">Note: You will be required to change this password immediately after your first login.</p>
    ` : ''}
  `;
  return getBaseLayout(content, "Welcome to the Manager Portal", opts);
}

export function getDismissalEmailHtml(opts: CommonEmailOptions & { name: string; role: string; reason: string; appealLink: string }) {
  if (opts.customTemplate) return renderTemplate(opts.customTemplate, opts);
  const content = `
    <p>Hi <strong>${opts.name}</strong>,</p>
    <p>We are writing to inform you that your employment as a <strong>${opts.role}</strong> at ${opts.storeName} has been terminated, effective immediately.</p>
    <div style="background: #fef2f2; padding: 15px 20px; border-left: 4px solid #ef4444; border-radius: 4px; margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; color: #b91c1c; font-size: 14px; text-transform: uppercase;">Reason for Dismissal</h3>
      <p style="margin: 0; color: #7f1d1d;">${opts.reason}</p>
    </div>
    <p>Your access to the system portal has been revoked.</p>
    <p>If you believe this decision was made in error or if there are extenuating circumstances we should consider, you have the right to appeal this decision within the next <strong>3 days</strong>.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${opts.appealLink}" style="display: inline-block; padding: 12px 24px; background: #ef4444; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Submit an Appeal</a>
    </div>
    <p style="font-size: 13px; color: #6b7280;">If you do not submit an appeal within 3 days, your credentials will be permanently deleted from our system.</p>
  `;
  return getBaseLayout(content, "Notice of Dismissal", opts);
}

export function getAppealResultEmailHtml(opts: CommonEmailOptions & { name: string; role: string; accepted: boolean; adminNotes?: string }) {
  if (opts.customTemplate) return renderTemplate(opts.customTemplate, opts);
  const content = `
    <p>Hi <strong>${opts.name}</strong>,</p>
    <p>We have reviewed your appeal regarding your dismissal from your position as a <strong>${opts.role}</strong> at ${opts.storeName}.</p>
    ${opts.accepted ? `
      <div style="background: #f0fdf4; padding: 15px 20px; border-left: 4px solid #10b981; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0; color: #065f46;"><strong>Appeal Accepted:</strong> Your appeal has been successful. Your access to the system has been restored, and you may resume your duties.</p>
      </div>
    ` : `
      <div style="background: #fef2f2; padding: 15px 20px; border-left: 4px solid #ef4444; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0; color: #b91c1c;"><strong>Appeal Rejected:</strong> After careful consideration, we have decided to uphold the original dismissal decision. Your credentials have been permanently deleted.</p>
      </div>
    `}
    ${opts.adminNotes ? `<p><strong>Feedback:</strong> ${opts.adminNotes}</p>` : ''}
    ${opts.accepted ? `<div style="text-align: center; margin: 30px 0;"><a href="${getStoreUrl(opts)}" style="display: inline-block; padding: 12px 24px; background: ${opts.primaryColor || '#3b82f6'}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Portal</a></div>` : ''}
  `;
  return getBaseLayout(content, "Appeal Review Result", opts);
}