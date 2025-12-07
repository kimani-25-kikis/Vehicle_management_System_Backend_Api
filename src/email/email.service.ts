import { transporter } from '../mailer/mailer.ts';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface WelcomeEmailData {
  customerName: string;
  customerEmail: string;
}

export class EmailService {
  // Send generic email
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"Rent Wheels" <${process.env.FROM_EMAIL}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent to:', options.to);
      return true;
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return false;
    }
  }

  // Send welcome email after registration
  static async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
    const subject = `Welcome to Rent Wheels! 🚗`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background: #f4f4f4;
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #000000, #333333);
            color: white; 
            padding: 40px 20px; 
            text-align: center; 
          }
          .logo { 
            font-size: 32px; 
            font-weight: bold; 
            margin-bottom: 10px;
            color: #d4af37;
          }
          .tagline {
            font-size: 18px;
            opacity: 0.9;
            font-style: italic;
          }
          .content { 
            padding: 40px 30px; 
          }
          .welcome-text {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 8px;
            border-left: 5px solid #d4af37;
            margin-bottom: 25px;
          }
          .features {
            margin: 25px 0;
          }
          .feature-item {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 6px;
          }
          .icon {
            font-size: 20px;
            margin-right: 15px;
            color: #d4af37;
          }
          .footer {
            background: #1a1a1a;
            color: white;
            padding: 20px;
            text-align: center;
            margin-top: 30px;
          }
          .contact-info {
            background: #fff3cd;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #ffeaa7;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">RENT WHEELS</div>
            <div class="tagline">Premium Vehicle Rentals</div>
          </div>
          
          <div class="content">
            <div class="welcome-text">
              <h2>Dear ${data.customerName},</h2>
              <p>Welcome to <strong>Luxury Motors</strong>! We're thrilled to have you join our family of premium vehicle enthusiasts.</p>
              
              <p>Thank you for choosing us for your luxury vehicle rental needs. We're committed to providing you with an exceptional experience from start to finish.</p>
            </div>

            <div class="features">
              <h3 style="color: #d4af37; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">What You Can Expect:</h3>
              
              <div class="feature-item">
                <span class="icon">🚗</span>
                <span><strong>Premium Fleet:</strong> Latest luxury vehicles maintained to perfection</span>
              </div>
              
              <div class="feature-item">
                <span class="icon">⭐</span>
                <span><strong>VIP Service:</strong> Personalized attention and premium support</span>
              </div>
              
              <div class="feature-item">
                <span class="icon">🔐</span>
                <span><strong>Secure Booking:</strong> Easy and secure online reservations</span>
              </div>
              
              <div class="feature-item">
                <span class="icon">🏆</span>
                <span><strong>Exclusive Deals:</strong> Special offers for our valued members</span>
              </div>
            </div>

            <div class="contact-info">
              <h4 style="margin-top: 0; color: #856404;">Get Started Today!</h4>
              <p>Browse our premium collection and book your first luxury vehicle experience.</p>
              <p style="margin-bottom: 0;"><strong>Ready to drive in style?</strong> Log in to your account and explore our fleet!</p>
            </div>

            <p>We're here to make your luxury car rental experience seamless and memorable.</p>
            
            <p>Best regards,<br>
            <strong>The Rent Wheels Team</strong></p>
          </div>

          <div class="footer">
            <p>Rent Wheels &copy; 2024 | Premium Vehicle Rentals</p>
            <p>Email: support@Rentwheels.com | Phone: +254 700 000 000</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Plain text version for email clients that don't support HTML
    const text = `
      Welcome to Rent Wheels!

      Dear ${data.customerName},

      Welcome to Luxury Motors! We're thrilled to have you join our family of premium vehicle enthusiasts.

      Thank you for choosing us for your luxury vehicle rental needs. We're committed to providing you with an exceptional experience from start to finish.

      What You Can Expect:
      🚗 Premium Fleet: Latest luxury vehicles maintained to perfection
      ⭐ VIP Service: Personalized attention and premium support
      🔐 Secure Booking: Easy and secure online reservations
      🏆 Exclusive Deals: Special offers for our valued members

      Get Started Today!
      Browse our premium collection and book your first luxury vehicle experience.

      Ready to drive in style? Log in to your account and explore our fleet!

      We're here to make your luxury car rental experience seamless and memorable.

      Best regards,
      The Rent Wheels Team

      Rent Wheeels © 2024 | Premium Vehicle Rentals
      Email: support@RentWheels.com | Phone: +254 700 000 000
    `;

    return await this.sendEmail({
      to: data.customerEmail,
      subject,
      html,
      text,
    });
  }

  static async sendTicketConfirmationEmail(data: {
    customerName: string;
    customerEmail: string;
    ticketId: number;
    subject: string;
    description: string;
    type: string;
    priority: string;
    status: string;
    bookingId?: number;
    createdAt: string;
  }): Promise<boolean> {
    const formatType = (type: string) => {
      return type.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const subject = `🎫 Support Ticket #${data.ticketId} Created`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background: #f4f4f4;
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 40px 20px; 
            text-align: center; 
          }
          .logo { 
            font-size: 32px; 
            font-weight: bold; 
            margin-bottom: 10px;
            color: #ffffff;
          }
          .tagline {
            font-size: 18px;
            opacity: 0.9;
          }
          .content { 
            padding: 40px 30px; 
          }
          .ticket-card {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            border-left: 5px solid #667eea;
            margin: 25px 0;
          }
          .ticket-id {
            background: #667eea;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 15px;
          }
          .badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin: 0 5px 5px 0;
          }
          .badge-type { background: #e6f7ff; color: #0066cc; }
          .badge-priority { background: #fff7e6; color: #d46b08; }
          .badge-status { background: #f6ffed; color: #52c41a; }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
          }
          .info-item {
            padding: 10px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e8e8e8;
          }
          .next-steps {
            background: #fff7e6;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid #faad14;
          }
          .urgent-note {
            background: #fff1f0;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #ffccc7;
            margin: 20px 0;
          }
          .footer {
            background: #1a1a1a;
            color: white;
            padding: 20px;
            text-align: center;
            margin-top: 30px;
          }
          .contact-box {
            background: #f0f5ff;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">RENT WHEELS</div>
            <div class="tagline">Support Ticket Confirmation</div>
          </div>
          
          <div class="content">
            <h2 style="color: #333; margin-top: 0;">Dear ${data.customerName},</h2>
            <p>Thank you for contacting Rent Wheels Support. Your ticket has been created successfully and is now in our system.</p>
            
            <div class="ticket-card">
              <div class="ticket-id">Ticket #${data.ticketId}</div>
              <h3 style="margin-top: 0; color: #333;">${data.subject}</h3>
              
              <div>
                <span class="badge badge-type">${formatType(data.type)}</span>
                <span class="badge badge-priority">${data.priority.toUpperCase()} Priority</span>
                <span class="badge badge-status">${data.status}</span>
              </div>
              
              <div class="info-grid">
                <div class="info-item">
                  <strong>📅 Created</strong><br>
                  ${formatDate(data.createdAt)}
                </div>
                ${data.bookingId ? `
                <div class="info-item">
                  <strong>📋 Booking Reference</strong><br>
                  #${data.bookingId}
                </div>
                ` : ''}
                <div class="info-item">
                  <strong>📧 Ticket ID</strong><br>
                  ${data.ticketId}
                </div>
              </div>
              
              <div style="margin-top: 20px;">
                <strong>📝 Description:</strong>
                <p style="background: white; padding: 15px; border-radius: 6px; margin: 10px 0;">
                  ${data.description}
                </p>
              </div>
            </div>

            ${data.type === 'damage_report' ? `
            <div class="urgent-note">
              <h4 style="color: #cf1322; margin-top: 0;">⚠️ Important Damage Report Notice</h4>
              <p>Our damage assessment team will contact you within 2 business hours. Please do not attempt repairs and keep any photographic evidence.</p>
            </div>
            ` : ''}

            <div class="next-steps">
              <h4 style="color: #d46b08; margin-top: 0;">📋 What Happens Next?</h4>
              <ul style="padding-left: 20px;">
                <li>Our support team will review your ticket within 24 hours</li>
                <li>You will receive email updates on your ticket status</li>
                <li>You can track progress in your dashboard</li>
                <li>Average response time: ${data.priority === 'urgent' ? '2 hours' : data.priority === 'high' ? '4 hours' : '24 hours'}</li>
              </ul>
            </div>

            <div class="contact-box">
              <h4 style="margin-top: 0; color: #1890ff;">Need Urgent Assistance?</h4>
              <p>Call our 24/7 support line: <strong>+254 700 000 000</strong></p>
              <p>Email: <strong>support@rentwheels.com</strong></p>
            </div>

            <p>Thank you for choosing Rent Wheels. We're committed to resolving your issue promptly.</p>
            
            <p>Best regards,<br>
            <strong>The Rent Wheels Support Team</strong></p>
          </div>

          <div class="footer">
            <p>Rent Wheels &copy; 2024 | Premium Vehicle Rentals</p>
            <p>Email: support@rentwheels.com | Phone: +254 700 000 000</p>
            <p style="font-size: 12px; opacity: 0.8;">This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Plain text version
    const text = `
      Support Ticket #${data.ticketId} Created
      
      Dear ${data.customerName},
      
      Thank you for contacting Rent Wheels Support. Your ticket has been created successfully.
      
      Ticket Details:
      - Ticket ID: #${data.ticketId}
      - Subject: ${data.subject}
      - Type: ${formatType(data.type)}
      - Priority: ${data.priority.toUpperCase()}
      - Status: ${data.status}
      - Created: ${formatDate(data.createdAt)}
      ${data.bookingId ? `- Booking Reference: #${data.bookingId}` : ''}
      
      Description:
      ${data.description}
      
      ${data.type === 'damage_report' ? `
      ⚠️ Important Damage Report Notice:
      Our damage assessment team will contact you within 2 business hours. 
      Please do not attempt repairs and keep any photographic evidence.
      ` : ''}
      
      What Happens Next?
      - Our support team will review your ticket within 24 hours
      - You will receive email updates on your ticket status
      - You can track progress in your dashboard
      - Average response time: ${data.priority === 'urgent' ? '2 hours' : data.priority === 'high' ? '4 hours' : '24 hours'}
      
      Need Urgent Assistance?
      Call our 24/7 support line: +254 700 000 000
      Email: support@rentwheels.com
      
      Thank you for choosing Rent Wheels.
      
      Best regards,
      The Rent Wheels Support Team
      
      ---
      Rent Wheels © 2024 | Premium Vehicle Rentals
      Email: support@rentwheels.com | Phone: +254 700 000 000
      This is an automated message. Please do not reply to this email.
    `;

    return await this.sendEmail({
      to: data.customerEmail,
      subject,
      html,
      text,
    });
  }

  static async sendAdminTicketNotification(data: {
    ticketId: number;
    subject: string;
    type: string;
    priority: string;
    customerName: string;
    customerEmail: string;
    description: string;
    bookingId?: number;
    createdAt: string;
  }): Promise<boolean> {
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['admin@rentwheels.com'];
    
    const formatType = (type: string) => {
      return type.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    };

    const subject = `🚨 New ${data.priority === 'urgent' ? 'URGENT ' : ''}Ticket: ${formatType(data.type)} - #${data.ticketId}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .urgent { background: #fff5f5; border-left: 4px solid #dc2626; padding: 20px; }
          .ticket-info { background: white; padding: 15px; border-radius: 8px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="urgent">
          <h2 style="color: #dc2626;">
            ${data.priority === 'urgent' ? '🚨 URGENT: ' : '📋 NEW: '}
            ${formatType(data.type)} Ticket #${data.ticketId}
          </h2>
          
          <div class="ticket-info">
            <p><strong>Customer:</strong> ${data.customerName} (${data.customerEmail})</p>
            <p><strong>Subject:</strong> ${data.subject}</p>
            <p><strong>Priority:</strong> <span style="color: ${data.priority === 'urgent' ? '#dc2626' : '#d46b08'}">${data.priority.toUpperCase()}</span></p>
            <p><strong>Created:</strong> ${new Date(data.createdAt).toLocaleString()}</p>
            ${data.bookingId ? `<p><strong>Booking:</strong> #${data.bookingId}</p>` : ''}
            <p><strong>Description:</strong><br>${data.description}</p>
          </div>
          
          <p><a href="${process.env.ADMIN_URL}/support/tickets/${data.ticketId}" style="background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Ticket in Admin Panel
          </a></p>
        </div>
      </body>
      </html>
    `;

    const text = `
      ${data.priority === 'urgent' ? '🚨 URGENT: ' : '📋 NEW: '}
      ${formatType(data.type)} Ticket #${data.ticketId}
      
      Customer: ${data.customerName} (${data.customerEmail})
      Subject: ${data.subject}
      Priority: ${data.priority.toUpperCase()}
      Created: ${new Date(data.createdAt).toLocaleString()}
      ${data.bookingId ? `Booking: #${data.bookingId}` : ''}
      
      Description:
      ${data.description}
      
      View ticket: ${process.env.ADMIN_URL}/support/tickets/${data.ticketId}
    `;

    // Send to all admin emails
    const emailPromises = adminEmails.map(email => 
      this.sendEmail({ to: email, subject, html, text })
    );
    
    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    return successCount > 0;
  }
}

