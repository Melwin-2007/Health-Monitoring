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
    risk_level = ml_output.get("health_risk_level", "Low")
    if risk_level not in ["High", "Severe"]:
        return

    now = datetime.now()
    last_time = _last_alert_time.get(risk_level)

    # Cooldown of 10 minutes (600 seconds) for the same alert level
    if last_time and (now - last_time).total_seconds() < 600:
        return

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
    
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
    try:
        with open(config_path, "r") as f:
            cfg = json.load(f)
            target_email = cfg.get("alert_email")
    except:
        target_email = None
        
    if target_email:
        # NOTE: You MUST provide your own SMTP credentials here for it to actually send.
        # It is highly recommended to use Environment Variables for security.
        SMTP_SERVER = "smtp.gmail.com"
        SMTP_PORT = 587
        SMTP_SENDER = "YOUR_GMAIL_HERE@gmail.com"
        # Generate an "App Password" in Google Account Security settings
        SMTP_PASSWORD = "YOUR_APP_PASSWORD_HERE"
        
        try:
            msg = MIMEMultipart()
            msg['From'] = SMTP_SENDER
            msg['To'] = target_email
            msg['Subject'] = alert['title']
            
            body = f"{alert['message']}\n\nAction Required: {alert['action_required']}"
            msg.attach(MIMEText(body, 'plain'))
            
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()
            server.login(SMTP_SENDER, SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()
            print(f"[EMAIL SENT] Successfully dispatched alert to {target_email}")
        except Exception as e:
            print(f"[EMAIL FAILED] Could not send email to {target_email}. Did you configure your SMTP credentials? Error: {e}")
