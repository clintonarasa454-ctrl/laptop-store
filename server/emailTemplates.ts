export interface CommonEmailOptions {
  storeName: string;
  logoUrl?: string;
  primaryColor?: string;
  contactEmail: string;
  emailBackgroundColor?: string;
  storePhone?: string;
}

function getHeaderHtml(storeName: string, logoUrl?: string) {
  return logoUrl 
    ? `<img src="${logoUrl}" alt="${storeName}" style="max-height: 50px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;" />` 
    : `<h2 style="margin-top: 0; color: #111; text-align: center;">${storeName}</h2>`;
}

export function getVerificationEmailHtml(opts: CommonEmailOptions & { name: string; otp: string; isResend?: boolean }) {
  const { storeName, primaryColor = "#3b82f6", contactEmail, storePhone, name, otp, isResend } = opts;
  const logoHtml = getHeaderHtml(storeName, opts.logoUrl);
  const actionText = isResend ? `You requested a new verification code for ${storeName}.` : `Welcome to ${storeName}!`;
  
  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">
        ${logoHtml}
        <h1 style="font-size: 24px; margin: 0; color: ${primaryColor};">Your Verification Code</h1>
      </div>
      <p style="font-size: 16px;">Hi <strong>${name}</strong>,</p>
      <p style="color: #4b5563;">${actionText} Please enter the following 6-digit code to activate your account. This code will expire in 24 hours.</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="display: inline-block; padding: 16px 32px; background: #f3f4f6; color: #111; border-radius: 8px; font-weight: bold; font-size: 32px; letter-spacing: 8px;">${otp}</span>
      </div>
      <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
        Need help? Contact us at <a href="mailto:${contactEmail}" style="color: ${primaryColor}; text-decoration: none;">${contactEmail}</a>${storePhone ? ` or call ${storePhone}` : ''}.
      </p>
    </div>
  `;
}

export function getResetPasswordEmailHtml(opts: CommonEmailOptions & { name: string; otp: string }) {
  const { storeName, primaryColor = "#3b82f6", contactEmail, storePhone, name, otp } = opts;
  const logoHtml = getHeaderHtml(storeName, opts.logoUrl);
  
  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">
        ${logoHtml}
        <h1 style="font-size: 24px; margin: 0; color: ${primaryColor};">Password Reset Code</h1>
      </div>
      <p style="font-size: 16px;">Hi <strong>${name || 'there'}</strong>,</p>
      <p style="color: #4b5563;">We received a request to reset your password for your ${storeName} account. Please enter the following 6-digit code to choose a new password. This code will expire in 15 minutes.</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="display: inline-block; padding: 16px 32px; background: #f3f4f6; color: #111; border-radius: 8px; font-weight: bold; font-size: 32px; letter-spacing: 8px;">${otp}</span>
      </div>
      <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
        If you didn't make this request, you can safely ignore this email.<br/><br/>
        Need help? Contact us at <a href="mailto:${contactEmail}" style="color: ${primaryColor}; text-decoration: none;">${contactEmail}</a>${storePhone ? ` or call ${storePhone}` : ''}.
      </p>
    </div>
  `;
}

export function getOrderConfirmationEmailHtml(opts: CommonEmailOptions & { shippingFullName: string; orderNumber: string; cartData: { name: string; slug?: string | null; price: string | number; quantity: number; image?: string | null }[]; subtotal: number; shippingCost: number; total: number; storeCurrency: string; customMessage?: string; host: string; orderLink: string; productImageWidth?: string | number; }) {
  const { storeName, primaryColor = "#3b82f6", contactEmail, storePhone, shippingFullName, orderNumber, cartData, subtotal, shippingCost, total, storeCurrency, customMessage, host, orderLink } = opts;
  const logoHtml = getHeaderHtml(storeName, opts.logoUrl);
  const formatEmailPrice = (p: string | number) => new Intl.NumberFormat("en-US", { style: "currency", currency: storeCurrency }).format(typeof p === "string" ? parseFloat(p) : p);

  const itemsHtml = cartData.map(item => {
    const productLink = item.slug ? `${host}/products/${item.slug}` : `${host}/products`;
    // Use the store logo as a fallback if the product image is missing
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

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px 24px; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); background-color: ${opts.emailBackgroundColor || '#ffffff'};">
      <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 15px; margin-bottom: 15px;">${logoHtml}<h1 style="font-size: 20px; margin: 0; color: #10b981;">Order Confirmed!</h1></div>
      <p style="font-size: 14px; margin-top: 0;">Hi <strong>${shippingFullName}</strong>,</p>
      <p style="font-size: 14px; color: #4b5563; margin-bottom: 20px;">${customMessage || "Thank you for your order. We are getting your items ready for shipment."}</p>
      <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0;">
        <h3 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Order Summary (#${orderNumber})</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          ${itemsHtml}
          <tr><td style="padding: 8px 0; font-weight: 600; padding-top: 12px; font-size: 13px;">Subtotal</td><td style="padding: 8px 0; text-align: right; font-weight: 600; padding-top: 12px; font-size: 13px;">${formatEmailPrice(subtotal)}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: 600; font-size: 13px;">Shipping</td><td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 13px;">${formatEmailPrice(shippingCost)}</td></tr>
          <tr><td style="padding: 12px 0 0 0; font-size: 16px; font-weight: 700; border-top: 2px solid #e5e7eb;">Total</td><td style="padding: 12px 0 0 0; font-size: 16px; font-weight: 700; text-align: right; border-top: 2px solid #e5e7eb;">${formatEmailPrice(total)}</td></tr>
        </table>
      </div>
       <div style="text-align: center; margin: 30px 0;"><a href="${orderLink}" style="display: inline-block; padding: 12px 24px; background: ${primaryColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">View Order</a></div>
      <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 15px;">Track your order status by logging into your dashboard.<br/>Need help? Contact us at <a href="mailto:${contactEmail}" style="color: ${primaryColor}; text-decoration: none;">${contactEmail}</a>${storePhone ? ` or call ${storePhone}` : ''}.</p>
    </div>
  `;
}

export function getShippingNotificationEmailHtml(opts: CommonEmailOptions & { shippingFullName: string; orderNumber: string; trackingNumber?: string; trackLink: string; customMessage?: string; shippingAddress: string; }) {
  const { storeName, primaryColor = "#3b82f6", contactEmail, storePhone, shippingFullName, orderNumber, trackingNumber, trackLink, customMessage, shippingAddress } = opts;
  const logoHtml = getHeaderHtml(storeName, opts.logoUrl);
  const trackingHtml = trackingNumber ? `<div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 24px 0; border: 1px solid #e5e7eb;"><p style="margin: 0 0 4px 0; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Tracking Number</p><a href="https://parcelsapp.com/en/tracking/${encodeURIComponent(trackingNumber)}" target="_blank" style="font-size: 18px; font-family: monospace; font-weight: bold; color: #8b5cf6; text-decoration: none;">${trackingNumber}</a></div>` : ``;

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">${logoHtml}<h1 style="font-size: 24px; margin: 0; color: #8b5cf6;">Your Order Has Shipped!</h1></div>
      <p style="font-size: 16px;">Hi <strong>${shippingFullName}</strong>,</p>
      <p style="color: #4b5563;">${customMessage || "Great news! Your order has been shipped and is on its way to you."}</p>
      <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0; font-size: 14px; color: #4b5563;">
        <p style="margin: 0 0 8px 0;"><strong>Order Number:</strong> #${orderNumber}</p>
        <p style="margin: 0;"><strong>Shipping To:</strong><br/>${shippingAddress.replace(/\n/g, '<br/>')}</p>
      </div>
      ${trackingHtml}
      <div style="text-align: center; margin: 30px 0;"><a href="${trackLink}" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Track Your Order</a></div>
      <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">Need help? Contact us at <a href="mailto:${contactEmail}" style="color: ${primaryColor}; text-decoration: none;">${contactEmail}</a>${storePhone ? ` or call ${storePhone}` : ''}.</p>
    </div>
  `;
}

export function getAbandonedCartEmailHtml(opts: CommonEmailOptions & { shippingFullName: string; orderNumber: string; total: string | number; orderLink: string; storeCurrency: string; cartData: { name: string; slug?: string | null; price: string | number; quantity: number; image?: string | null; }[]; host: string; productImageWidth?: string | number }) {
  const { storeName, primaryColor = "#3b82f6", contactEmail, storePhone, shippingFullName, orderNumber, total, orderLink, storeCurrency, cartData, host } = opts;
  const logoHtml = getHeaderHtml(storeName, opts.logoUrl);
  const formatEmailPrice = (p: string | number) => new Intl.NumberFormat("en-US", { style: "currency", currency: storeCurrency }).format(typeof p === "string" ? parseFloat(p) : p);

  const itemsHtml = cartData.map(item => {
    const productLink = item.slug ? `${host}/products/${item.slug}` : `${host}/products`;
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

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px 24px; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 15px; margin-bottom: 15px;">${logoHtml}<h1 style="font-size: 20px; margin: 0; color: #f59e0b;">You left something behind!</h1></div>
      <p style="font-size: 14px; margin-top: 0;">Hi <strong>${shippingFullName}</strong>,</p>
      <p style="font-size: 14px; color: #4b5563; margin-bottom: 20px;">We noticed you started an order but haven't completed the payment yet. Your items are currently saved, but they might sell out soon!</p>
      
      <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0;">
        <h3 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Your Cart (#${orderNumber})</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          ${itemsHtml}
          <tr><td colspan="2" style="padding: 12px 0 0 0; font-size: 14px; font-weight: 700; border-top: 2px solid #e5e7eb; text-align: right;">Total: ${formatEmailPrice(total)}</td></tr>
        </table>
      </div>

      <div style="text-align: center; margin: 30px 0;"><a href="${orderLink}" style="display: inline-block; padding: 12px 24px; background: ${primaryColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Complete Your Order</a></div>
      <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 15px;">Need help? Contact us at <a href="mailto:${contactEmail}" style="color: ${primaryColor}; text-decoration: none;">${contactEmail}</a>${storePhone ? ` or call ${storePhone}` : ''}.</p>
    </div>
  `;
}

export function getOrderCancelledEmailHtml(opts: CommonEmailOptions & { shippingFullName: string; orderNumber: string; total: string | number; storeCurrency: string; }) {
  const { storeName, primaryColor = "#3b82f6", contactEmail, storePhone, shippingFullName, orderNumber, total, storeCurrency } = opts;
  const logoHtml = getHeaderHtml(storeName, opts.logoUrl);
  const formatEmailPrice = (p: string | number) => new Intl.NumberFormat("en-US", { style: "currency", currency: storeCurrency }).format(typeof p === "string" ? parseFloat(p) : p);

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px 24px; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 15px; margin-bottom: 15px;">${logoHtml}<h1 style="font-size: 20px; margin: 0; color: #ef4444;">Order Cancelled</h1></div>
      <p style="font-size: 14px; margin-top: 0;">Hi <strong>${shippingFullName}</strong>,</p>
      <p style="font-size: 14px; color: #4b5563; margin-bottom: 20px;">This email confirms that your order <strong>#${orderNumber}</strong> has been successfully cancelled.</p>
      <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">If you have already paid, a refund for <strong>${formatEmailPrice(total)}</strong> will be processed within 3-5 business days.</p>
      </div>
      <div style="text-align: center; margin: 30px 0;"><a href="${process.env.PUBLIC_URL || 'http://localhost:3000'}/products" style="display: inline-block; padding: 12px 24px; background: ${primaryColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Continue Shopping</a></div>
      <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 15px;">If you did not request this cancellation, please contact us immediately at <a href="mailto:${contactEmail}" style="color: ${primaryColor}; text-decoration: none;">${contactEmail}</a>${storePhone ? ` or call ${storePhone}` : ''}.</p>
    </div>
  `;
}

export function getAdminOrderCancelledEmailHtml(opts: CommonEmailOptions & { orderNumber: string; shippingFullName: string; shippingEmail: string | null; total: string | number; paymentStatus: string; reason?: string; storeCurrency: string; }) {
  const { storeName, primaryColor = "#ef4444", orderNumber, shippingFullName, shippingEmail, total, paymentStatus, reason, storeCurrency } = opts;
  const logoHtml = getHeaderHtml(storeName, opts.logoUrl);
  const formatEmailPrice = (p: string | number) => new Intl.NumberFormat("en-US", { style: "currency", currency: storeCurrency }).format(typeof p === "string" ? parseFloat(p) : p);

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px 24px; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 15px; margin-bottom: 15px;">${logoHtml}<h1 style="font-size: 20px; margin: 0; color: ${primaryColor};">Order Cancelled by Customer</h1></div>
      <p style="font-size: 14px; margin-top: 0;">A customer has just cancelled their order via the tracking page.</p>
      <div style="background: #f9fafb; padding: 15px 20px; border-radius: 6px; margin: 15px 0;">
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #4b5563; line-height: 1.6;">
          <li><strong>Order Number:</strong> ${orderNumber}</li>
          <li><strong>Customer:</strong> ${shippingFullName} (${shippingEmail || 'N/A'})</li>
          <li><strong>Total:</strong> ${formatEmailPrice(total)}</li>
          <li><strong>Payment Status:</strong> ${paymentStatus}</li>
          <li><strong>Reason:</strong> ${reason || "None provided"}</li>
        </ul>
      </div>
      <p style="font-size: 14px; color: #4b5563;">Please log in to the Admin Panel > Orders to review this cancellation and process any necessary refunds.</p>
    </div>
  `;
}