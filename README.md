# Medicare-portal
Pharmacy stock &amp; dispensing portal (HTML + JS frontend + Python API).

Project Name: Medicare Portal

Summary:
A lightweight pharmacy inventory and dispensing portal with a Bootstrap frontend and a Python backend API. The UI supports adding medicines, viewing stock, dispensing items, notifications for expiry/low stock, and activity reporting.

Features:
1.Add / delete medicines.
2.Dispense medicines with patient recording.
3.Notifications for near-expiry and low stock.
4.Activity history / report and ability to clear history.
5 .Simple, responsive Bootstrap UI.

Files:
Frontend: project.html — main UI (Bootstrap + JS).
Backend: server.py — API server (runs on localhost:5000).
DB schema: create_database.sql — initial DB setup.

Tech stack:
Frontend: HTML, Bootstrap, vanilla JavaScript (fetch API).
Backend: Python 
Storage: SQL database 

Usage:
Login using the admin credentials configured in the UI (admin / admin123 by default).
Add medicines via the "Add Medicine" form.
Use "Dispense" to record dispensing events and reduce stock.
View "Notification" for expiry/low-stock alerts.
Use "Report" to view activity history and clear it when needed.
