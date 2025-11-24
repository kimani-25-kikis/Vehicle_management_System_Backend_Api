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
        from: `"Luxury Motors" <${process.env.FROM_EMAIL}>`,
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
    const subject = `Welcome to Luxury Motors! 🚗`;
    
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
            <div class="logo">LUXURY MOTORS</div>
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
            <strong>The Luxury Motors Team</strong></p>
          </div>

          <div class="footer">
            <p>Luxury Motors &copy; 2024 | Premium Vehicle Rentals</p>
            <p>Email: support@luxurymotors.com | Phone: +254 700 000 000</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Plain text version for email clients that don't support HTML
    const text = `
      Welcome to Luxury Motors!

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
      The Luxury Motors Team

      Luxury Motors © 2024 | Premium Vehicle Rentals
      Email: support@luxurymotors.com | Phone: +254 700 000 000
    `;

    return await this.sendEmail({
      to: data.customerEmail,
      subject,
      html,
      text,
    });
  }
}