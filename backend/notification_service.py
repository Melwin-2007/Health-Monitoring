import os
import json
from datetime import datetime

NOTIFICATIONS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "notifications.json")

# Prevent spam: only alert once every 10 minutes per level
_last_alert_time = {}

def get_all_notifications():
    if not os.path.exists(NOTIFICATIONS_FILE):
        return []
    try:
        with open(NOTIFICATIONS_FILE, "r") as f:
            return json.load(f)
    except:
        return []

def save_notification(alert):
    alerts = get_all_notifications()
    alerts.append(alert)
    # keep only last 50
    alerts = alerts[-50:]
    with open(NOTIFICATIONS_FILE, "w") as f:
        json.dump(alerts, f, indent=2)

def check_and_send_alert(ml_output: dict):
    # Removed threshold check to trigger on every reading
    risk_level = ml_output.get("health_risk_level", "Low")
    now = datetime.now()
    last_time = _last_alert_time.get(risk_level)

    # Removed cooldown to allow continuous emails

    _last_alert_time[risk_level] = now

    alert = {
        "timestamp": now.isoformat(),
        "level": risk_level,
        "title": f"[{risk_level.upper()}] Health Risk Alert",
        "message": ml_output.get("health_risk_summary", "Air quality has reached dangerous levels."),
        "action_required": ml_output.get("ventilation_advisory", "Take precautions immediately.")
    }

    # Simulate sending push notification / SMS
    print(f"\n[PUSH NOTIFICATION DISPATCHED]")
    print(f"TITLE: {alert['title']}")
    print(f"BODY: {alert['message']} -> {alert['action_required']}\n")

    save_notification(alert)
    
    # -----------------------------------------------------
    # Email Dispatcher
    # -----------------------------------------------------
    import os, json, smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from email.mime.image import MIMEImage
    
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
    try:
        with open(config_path, "r") as f:
            cfg = json.load(f)
            target_email = cfg.get("alert_email")
    except:
        target_email = None
    
    # Hardcoded override as requested
    target_email = "darshanpatil0906@gmail.com"
        
    if target_email:
        # Load from environment variables (from .env)
        SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
        SMTP_SENDER = os.getenv("SMTP_SENDER")
        # Automatically remove spaces from the Google App Password if the user pasted them
        SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").replace(" ", "")
        
        if not SMTP_SENDER or not SMTP_PASSWORD:
            print(f"[EMAIL ABORTED] Missing SMTP_SENDER or SMTP_PASSWORD in environment variables.")
            return

        try:
            msg = MIMEMultipart('related')
            msg['From'] = f"Smart Air Quality Monitoring system <{SMTP_SENDER}>"
            msg['To'] = target_email
            msg['Subject'] = alert['title']
            
            # Create the HTML structure
            html = f"""
            <html>
              <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                  <!-- Header Image -->
                  <img src="cid:banner" alt="Dangerous Air Pollution Levels" style="width: 100%; display: block;" />
                  
                  <!-- Content Body -->
                  <div style="padding: 30px;">
                    <h2 style="color: #dc2626; margin-top: 0; font-size: 24px;">Dangerous air pollution levels.</h2>
                    <p style="font-size: 16px; color: #4b5563; font-weight: bold; margin-bottom: 25px;">Urgent precautions required.</p>
                    
                    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 4px;">
                      <h3 style="color: #b91c1c; margin-top: 0; font-size: 18px; text-transform: uppercase;">Action Required</h3>
                      <p style="color: #7f1d1d; margin-bottom: 0; font-size: 16px;">{alert['action_required']}</p>
                    </div>
                    
                    <p style="font-size: 14px; color: #6b7280; margin-top: 25px;">
                      <strong>Detailed Analysis:</strong><br/>
                      {alert['message']}
                    </p>
                    
                    <p style="font-size: 12px; color: #9ca3af; margin-top: 40px; text-align: center;">
                      Sent automatically by your Smart Air Quality Monitoring system
                    </p>
                  </div>
                </div>
              </body>
            </html>
            """
            
            msg_alternative = MIMEMultipart('alternative')
            msg.attach(msg_alternative)
            
            plain_text = f"Dangerous air pollution levels. Urgent precautions required.\n\nAction Required: {alert['action_required']}\n\nDetails: {alert['message']}"
            msg_alternative.attach(MIMEText(plain_text, 'plain'))
            msg_alternative.attach(MIMEText(html, 'html'))
            
            # Attach Image
            banner_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "alert_banner.jpg")
            if os.path.exists(banner_path):
                with open(banner_path, 'rb') as img_file:
                    msg_image = MIMEImage(img_file.read())
                    msg_image.add_header('Content-ID', '<banner>')
                    msg.attach(msg_image)
            
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()
            server.login(SMTP_SENDER, SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()
            print(f"[EMAIL SENT] Successfully dispatched alert to {target_email}")
        except Exception as e:
            print(f"[EMAIL FAILED] Could not send email to {target_email}. Did you configure your SMTP credentials? Error: {e}")
